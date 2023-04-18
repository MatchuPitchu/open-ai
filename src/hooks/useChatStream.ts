import { useCallback, useState } from 'react';
import { SSE } from '@/utils/sse';
import type { ReadyStateEventData, MessageEventData, RequestOptions } from '@/utils/sse';

type DeepRequired<T> = T extends object
  ? {
      [Property in keyof T]-?: DeepRequired<T[Property]>;
    }
  : T;

export type GPT35 = 'gpt-3.5-turbo' | 'gpt-3.5-turbo-0301';
export type GPT4 = 'gpt-4' | 'gpt-4-0314' | 'gpt-4-32k' | 'gpt-4-32k-0314';
export type Model = GPT35 | GPT4;

export type ChatRole = 'user' | 'assistant' | 'system' | '';

export type ChatCompletionResponseMessage = {
  content: string; // content of the completion
  role: ChatRole; // role of the person/AI in the message
};

type ChatCompletionIncomingChunk = Partial<ChatCompletionResponseMessage>;

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

// transform chat message with metadata to a limited shape that OpenAI API expects
const getOpenAIRequestMessage = ({ content, role }: ChatMessage): ChatCompletionResponseMessage => ({
  content,
  role
});

// a) filter out last message (= placeholder), since it's message server will return from the request
// b) transform message structure to only what the OpenAI API expects
const getOpenAIRequestMessages = (messages: ChatMessage[]) =>
  messages.filter((_, index) => messages.length - 1 !== index).map(getOpenAIRequestMessage);

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
  const [isLoading, setIsLoading] = useState(false);

  const resetMessages = () => setMessages([]);

  const closeStream = useCallback(() => {
    setIsLoading(false);
    source?.close();
  }, [source]);

  const handleChunk = useCallback(
    (event: CustomEvent<MessageEventData>) => {
      // if [DONE] token is found, stream was finished
      if (event.detail.data === '[DONE]') {
        closeStream();
      }

      // parse the data from the update.
      let payload: any;
      try {
        payload = JSON.parse(event.detail.data ?? '{}');
      } catch (error) {
        payload = undefined;
      }

      const chunk: ChatCompletionIncomingChunk = payload?.choices?.[0]?.delta;

      // if chunk, update last message entry in list with the most recently received chunk
      if (!chunk) return;

      setMessages((prevMessages) => {
        const lastMessageIndex = prevMessages.length - 1;
        const updatedLastMessage = {
          content: `${prevMessages[lastMessageIndex].content}${chunk?.content ?? ''}`,
          role: `${prevMessages[lastMessageIndex].role}${chunk?.role ?? ''}` as ChatRole,
          timestamp: 0,
          meta: {
            ...prevMessages[lastMessageIndex].meta,
            chunks: [
              ...prevMessages[lastMessageIndex].meta.chunks,
              {
                content: chunk?.content ?? '',
                role: chunk?.role ?? '',
                timestamp: Date.now()
              }
            ]
          }
        };

        return updateLastItem(prevMessages, updatedLastMessage);
      });
    },
    [closeStream]
  );

  const handleCloseStream = (startTimestamp: number) => {
    // Determine the final timestamp, and calculate the number of seconds the full request took.
    const endTimestamp = Date.now();
    const differenceInSeconds = (endTimestamp - startTimestamp) / MILLISECONDS_PER_SECOND;
    const formattedDiff = `${differenceInSeconds.toFixed(2)} Sekunden`;

    // update the messages list, specifically update the last message entry with the final
    // details of the full request/response.
    setMessages((prevMessages) => {
      const lastMessageIndex = prevMessages.length - 1;
      const updatedLastMessage = {
        ...prevMessages[lastMessageIndex],
        timestamp: endTimestamp,
        meta: {
          ...prevMessages[lastMessageIndex].meta,
          loading: false,
          responseTime: formattedDiff
        }
      };

      return updateLastItem(prevMessages, updatedLastMessage);
    });
  };

  const submitPrompt = useCallback(
    (newPrompt: ChatMessageParams[]) => {
      // a) avoid two streaming calls at once - indicator: last message of list
      // b) no request if empty string as prompt
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.meta?.loading || !newPrompt[0].content) return;

      setIsLoading(true);

      const startTimestamp = Date.now();

      // placeholder for next message that will be returned from API
      const placeholderMessage = createChatMessage({ content: '', role: '', meta: { loading: true } });
      const updatedMessages: ChatMessage[] = [...messages, ...newPrompt.map(createChatMessage), placeholderMessage];
      setMessages(updatedMessages);

      const requestOptions: RequestOptions = {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          model,
          messages: getOpenAIRequestMessages(updatedMessages),
          stream: true
        }),
        withCredentials: false
      };

      const source = new SSE(CHAT_COMPLETIONS_URL, requestOptions);

      source.addEventListener('message', handleChunk);
      source.addEventListener('readystatechange', (event: CustomEvent<ReadyStateEventData>) => {
        // readyState: 0 - connecting, 1 - open, 2 - closed
        const readyState = event.detail.readyState;
        if (readyState !== 2) return;
        handleCloseStream(startTimestamp);
      });

      source.stream();

      setSource(source);
    },
    [apiKey, handleChunk, messages, model]
  );

  return { messages, submitPrompt, resetMessages, isLoading, closeStream };
};
