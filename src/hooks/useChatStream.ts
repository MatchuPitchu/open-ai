import { useCallback, useState } from 'react';
import { SSE, SourceState, isMessageEventData } from '@/utils/sse';
import type { RequestOptions } from '@/utils/sse';
import type { DeepRequired } from '@/utils/type-helpers';

export type GPT35 = 'gpt-3.5-turbo' | 'gpt-3.5-turbo-0301';
export type GPT4 = 'gpt-4' | 'gpt-4-0314' | 'gpt-4-32k' | 'gpt-4-32k-0314';
export type Model = GPT35 | GPT4;

export type ChatRole = 'user' | 'assistant' | 'system' | '';

export type ChatCompletionResponseMessage = {
  content: string; // content of the completion
  role: ChatRole; // role of the person/AI in the message
};

export type ChatMessageToken = ChatCompletionResponseMessage & {
  timestamp: number;
};

export type ChatMessageParams = ChatCompletionResponseMessage & {
  timestamp?: number; // The timestamp of when the completion finished
  meta?: {
    loading?: boolean; // If the completion is still being executed
    responseTime?: string; // The total elapsed time the completion took
    chunks?: ChatMessageToken[]; // The chunks returned as a part of streaming the execution of the completion
  };
};

export type ChatMessage = DeepRequired<ChatMessageParams>;

export type ChatCompletionChunk = {
  id: string;
  object: string;
  created: number;
  model: Model;
  choices: {
    delta: Partial<ChatCompletionResponseMessage>;
    index: number;
    finish_reason: string | null;
  }[];
};

export type OpenAIStreamingProps = {
  apiKey: string;
  model: Model;
};

const CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const MILLISECONDS_PER_SECOND = 1000;

const updateLastItem = <T>(currentItems: T[], updatedLastItem: T) => {
  const newItems = currentItems.slice(0, -1);
  newItems.push(updatedLastItem);
  return newItems;
};

// transform chat message structure with metadata to a limited shape that OpenAI API expects
const getOpenAIRequestMessage = ({ content, role }: ChatMessage): ChatCompletionResponseMessage => ({
  content,
  role
});

const getRequestOptions = (apiKey: string, model: Model, messages: ChatMessage[]): RequestOptions => ({
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  },
  method: 'POST',
  body: JSON.stringify({
    model,
    messages: messages.map(getOpenAIRequestMessage),
    stream: true
  }),
  withCredentials: false
});

// transform chat message into a chat message with metadata
const createChatMessage = ({ content, role, meta }: ChatMessageParams): ChatMessage => ({
  content,
  role,
  timestamp: Date.now(),
  meta: {
    loading: false,
    responseTime: '',
    chunks: [],
    ...meta
  }
});

export const useChatStream = ({ model, apiKey }: OpenAIStreamingProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [source, setSource] = useState<SSE>();

  const isLoading = source?.readyState === SourceState.CONNECTING || source?.readyState === SourceState.OPEN;

  const resetMessages = () => setMessages([]);
  const closeStream = useCallback(() => source?.close(), [source]);

  const handleChunk = useCallback(
    (event: CustomEvent) => {
      if (!isMessageEventData(event)) return;

      // if [DONE] token is found, stream was finished
      if (event.detail.data === '[DONE]') {
        closeStream();
        return;
      }

      try {
        const payload: ChatCompletionChunk = JSON.parse(event.detail.data);
        const chunkContent: string = payload.choices[0].delta.content ?? '';
        const chunkRole: ChatRole = payload.choices[0].delta.role ?? '';

        // update last message entry in list with the most recent chunk
        setMessages((prevMessages) => {
          const lastIndex = prevMessages.length - 1;
          const updatedLastMessage = {
            content: `${prevMessages[lastIndex].content}${chunkContent}`,
            role: `${prevMessages[lastIndex].role}${chunkRole}` as ChatRole,
            timestamp: 0,
            meta: {
              ...prevMessages[lastIndex].meta,
              chunks: [
                ...prevMessages[lastIndex].meta.chunks,
                {
                  content: chunkContent,
                  role: chunkRole,
                  timestamp: Date.now()
                }
              ]
            }
          };

          return updateLastItem(prevMessages, updatedLastMessage);
        });
      } catch (error) {
        console.error(`Error with JSON.parse and ${event.detail.data}`, error);
      }
    },
    [closeStream]
  );

  const handleCloseStream = (startTimestamp: number) => {
    // Determine the final timestamp, and calculate the number of seconds the full request took.
    const endTimestamp = Date.now();
    const differenceInSeconds = (endTimestamp - startTimestamp) / MILLISECONDS_PER_SECOND;
    const formattedDiff = `${differenceInSeconds.toFixed(2)}s`;

    // update the messages list, specifically update the last message entry with the final
    // details of the full request/response.
    setMessages((prevMessages) => {
      const lastIndex = prevMessages.length - 1;
      const updatedLastMessage = {
        ...prevMessages[lastIndex],
        timestamp: endTimestamp,
        meta: {
          ...prevMessages[lastIndex].meta,
          loading: false,
          responseTime: formattedDiff
        }
      };

      return updateLastItem(prevMessages, updatedLastMessage);
    });
  };

  const submitPrompt = useCallback(
    (newPrompt: ChatMessageParams[]) => {
      // a) no new request if last stream is loading
      // b) no request if empty string as prompt
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.meta?.loading || !newPrompt[0].content) return;

      const startTimestamp = Date.now();
      const chatMessages: ChatMessage[] = [...messages, ...newPrompt.map(createChatMessage)];

      const source = new SSE(CHAT_COMPLETIONS_URL, getRequestOptions(apiKey, model, chatMessages));
      setSource(source);

      // placeholder for next message that will be returned from API
      const placeholderMessage = createChatMessage({ content: '', role: '', meta: { loading: true } });
      setMessages([...chatMessages, placeholderMessage]);

      source.addEventListener('message', handleChunk);
      source.addEventListener('readystatechange', () => {
        if (source.readyState === SourceState.CLOSED) {
          handleCloseStream(startTimestamp);
        }
      });

      source.stream();
    },
    [apiKey, handleChunk, messages, model]
  );

  return { messages, submitPrompt, resetMessages, isLoading, closeStream };
};
