import { useCallback, useState } from 'react';
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
  timestamp?: number; // timestamp of completed request
  meta?: {
    loading?: boolean; // completion state
    responseTime?: string; // total elapsed time between completion start and end
    chunks?: ChatMessageToken[]; // returned chunks of completion stream
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

type RequestOptions = {
  headers: Record<string, string>;
  method: 'POST';
  body: string;
  signal: AbortSignal;
};

export type OpenAIStreamingProps = {
  apiKey: string;
  model: Model;
};

const OPENAI_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
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

const getOpenAIRequestOptions = (
  apiKey: string,
  model: Model,
  messages: ChatMessage[],
  signal: AbortSignal
): RequestOptions => ({
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  },
  method: 'POST',
  body: JSON.stringify({
    model,
    messages: messages.map(getOpenAIRequestMessage),
    // TODO: define value: max_tokens: 100,
    stream: true
  }),
  signal
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

export const useOpenAIChatStream = ({ model, apiKey }: OpenAIStreamingProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [controller, setController] = useState<AbortController | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const resetMessages = () => setMessages([]);

  const abortStream = () => {
    // abort fetch request by calling abort() on the AbortController instance
    if (!controller) return;
    controller.abort();
    setController(null);
  };

  const closeStream = (startTimestamp: number) => {
    // determine the final timestamp, and calculate the number of seconds the full request took.
    const endTimestamp = Date.now();
    const differenceInSeconds = (endTimestamp - startTimestamp) / MILLISECONDS_PER_SECOND;
    const formattedDiff = `${differenceInSeconds.toFixed(2)}s`;

    // update last entry of message list with the final details
    setMessages((prevMessages) => {
      const lastMessage = prevMessages.at(-1);
      if (!lastMessage) return [];

      const updatedLastMessage = {
        ...lastMessage,
        timestamp: endTimestamp,
        meta: {
          ...lastMessage.meta,
          loading: false,
          responseTime: formattedDiff
        }
      };

      return updateLastItem(prevMessages, updatedLastMessage);
    });
  };

  const submitPrompt = useCallback(
    async (newPrompt: ChatMessageParams[]) => {
      // a) no new request if last stream is loading
      // b) no request if empty string as prompt
      if (isLoading || !newPrompt[0].content) return;

      setIsLoading(true);

      const startTimestamp = Date.now();
      const chatMessages: ChatMessage[] = [...messages, ...newPrompt.map(createChatMessage)];

      const newController = new AbortController();
      const signal = newController.signal;
      setController(newController);

      try {
        const response = await fetch(
          OPENAI_COMPLETIONS_URL,
          getOpenAIRequestOptions(apiKey, model, chatMessages, signal)
        );

        if (!response.body) return;
        // read response as data stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        // placeholder for next message that will be returned from API
        const placeholderMessage = createChatMessage({ content: '', role: '', meta: { loading: true } });
        let currentMessages = [...chatMessages, placeholderMessage];

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            closeStream(startTimestamp);
            break;
          }
          // parse chunk of data
          const chunk = decoder.decode(value);
          const lines = chunk.split(/(\n){2}/);

          const parsedLines: ChatCompletionChunk[] = lines
            .map((line) => line.replace(/(\n)?^data:\s*/, '').trim()) // remove 'data:' prefix
            .filter((line) => line !== '' && line !== '[DONE]') // remove empty lines and "[DONE]"
            .map((line) => JSON.parse(line)); // parse JSON string

          for (const parsedLine of parsedLines) {
            let chunkContent: string = parsedLine.choices[0].delta.content ?? '';
            chunkContent = chunkContent.replace(/^`\s*/, '`'); // avoid empty line after single backtick
            const chunkRole: ChatRole = parsedLine.choices[0].delta.role ?? '';

            // update last message entry in list with the most recent chunk
            const lastMessage = currentMessages.at(-1);
            if (!lastMessage) return;

            const updatedLastMessage = {
              content: `${lastMessage.content}${chunkContent}`,
              role: `${lastMessage.role}${chunkRole}` as ChatRole,
              timestamp: 0,
              meta: {
                ...lastMessage.meta,
                chunks: [
                  ...lastMessage.meta.chunks,
                  {
                    content: chunkContent,
                    role: chunkRole,
                    timestamp: Date.now()
                  }
                ]
              }
            };

            currentMessages = updateLastItem(currentMessages, updatedLastMessage);
            setMessages(currentMessages);
          }
        }
      } catch (error) {
        if (signal.aborted) {
          console.error(`Request aborted`, error);
        } else {
          console.error(`Error during chat response streaming`, error);
        }
      } finally {
        setController(null); // reset AbortController
        setIsLoading(false);
      }
    },
    [apiKey, isLoading, messages, model]
  );

  return { messages, submitPrompt, resetMessages, isLoading, abortStream };
};
