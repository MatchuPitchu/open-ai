import { useCallback, useState } from 'react';
import { SSE } from 'sse.js';
import type { SSEEvent } from 'sse.js';

type DeepRequired<T> = T extends object
  ? {
      [Property in keyof T]-?: DeepRequired<T[Property]>;
    }
  : T;

export type GPT35 = 'gpt-3.5-turbo' | 'gpt-3.5-turbo-0301';
export type GPT4 = 'gpt-4' | 'gpt-4-0314' | 'gpt-4-32k' | 'gpt-4-32k-0314';

export type ChatCompletionResponseMessage = {
  content: string; // content of the completion
  role: string; // role of the person/AI in the message
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
  model: GPT35 | GPT4;
};

const CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

// Utility method for transforming a chat message decorated with metadata to a more limited shape
// that the OpenAI API expects.
const officialOpenAIParams = ({ content, role }: ChatMessage): ChatCompletionResponseMessage => ({ content, role });

// Utility method for transforming a chat message that may or may not be decorated with metadata
// to a fully-fledged chat message with metadata.
const createChatMessage = ({ content, role, ...restOfParams }: ChatMessageParams): ChatMessage => {
  return {
    content,
    role,
    timestamp: restOfParams.timestamp || Date.now(),
    meta: {
      loading: false,
      responseTime: '',
      chunks: [],
      ...restOfParams.meta
    }
  };
};

export const useChatStream = ({ model, apiKey }: OpenAIStreamingProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [source, setSource] = useState<SSE>();
  const [isLoading, setIsLoading] = useState(false);

  const resetMessages = () => setMessages([]);

  const closeStream = useCallback(() => {
    setIsLoading(false);
    source?.close();
  }, [source]);

  const handleChunkResponse = useCallback(
    (event: SSEEvent) => {
      // if [DONE] token is found, stream was finished
      if (event?.data === '[DONE]') {
        closeStream();
      }

      // Parse the data from the update.
      let payload;

      try {
        payload = JSON.parse(event?.data ?? '{}');
      } catch (error) {
        payload = undefined;
      }

      const chunk: ChatCompletionIncomingChunk = payload?.choices?.[0]?.delta;

      // If the chunk is well-formed, update the messages list, specifically update the last
      // message entry in the list with the most recently received chunk.
      if (!chunk) return;

      setMessages((prev) => {
        const lastMessageChunkAdded = {
          content: `${prev[prev.length - 1].content}${chunk?.content ?? ''}`,
          role: `${prev[prev.length - 1].role}${chunk?.role ?? ''}`,
          timestamp: 0,
          meta: {
            ...prev[prev.length - 1].meta,
            chunks: [
              ...prev[prev.length - 1].meta.chunks,
              {
                content: chunk?.content ?? '',
                role: chunk?.role ?? '',
                timestamp: Date.now()
              }
            ]
          }
        };

        const updatedMessages = prev.slice(0, -1);

        updatedMessages.push(lastMessageChunkAdded);

        return updatedMessages;
      });
    },
    [closeStream]
  );

  const handleConnectionClosed = (event: SSEEvent, beforeTimestamp: number) => {
    // readyState: 0 - connecting, 1 - open, 2 - closed
    if (event.readyState && event.readyState > 1) {
      // Determine the final timestamp, and calculate the number of seconds the full request took.
      const afterTimestamp = Date.now();
      const differenceInSeconds = (afterTimestamp - beforeTimestamp) / 1000;
      const formattedDiff = `${differenceInSeconds.toFixed(2)} Sekunden`;

      // Update the messages list, specifically update the last message entry with the final
      // details of the full request/response.
      setMessages((prev) => {
        const lastMessageChunkAdded = {
          ...prev[prev.length - 1],
          timestamp: afterTimestamp,
          meta: {
            ...prev[prev.length - 1].meta,
            loading: false,
            responseTime: formattedDiff
          }
        };

        const updatedMessages = prev.slice(0, -1);

        updatedMessages.push(lastMessageChunkAdded);
        return updatedMessages;
      });
    }
  };

  const submitStreamingPrompt = useCallback(
    (newMessages: ChatMessageParams[]) => {
      // Don't let two streaming calls occur at the same time. If the last message in the list has
      // a `loading` state set to true, we know there is a request in progress.
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.meta?.loading) return;

      // if empty string as prompt, do not make a request.
      if (!newMessages[0].content) return;

      setIsLoading(true);

      // Record the timestamp before the request starts.
      const beforeTimestamp = Date.now();

      // update the messages list with new message and a placeholder
      // for the next message that will be returned from the API
      const updatedMessages: ChatMessage[] = [
        ...messages,
        ...newMessages.map(createChatMessage),
        createChatMessage({ content: '', role: '', meta: { loading: true } })
      ];

      setMessages(updatedMessages);

      const requestOptions = {
        // define request headers
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        method: 'POST',
        payload: JSON.stringify({
          model,
          // filter out last message (including a placeholder for the UI), since technically
          // that is the message that the server will return from this request
          // transform message structure to only what the OpenAI API expects
          messages: updatedMessages
            .filter((_, index) => updatedMessages.length - 1 !== index)
            .map(officialOpenAIParams),
          stream: true
        })
      } as const;

      // create SSE request to the OpenAI chat completion API endpoint
      const source = new SSE(CHAT_COMPLETIONS_URL, requestOptions);

      // listen for event that chunk is received -> process it and store it in the latest message
      source.addEventListener('message', handleChunkResponse);

      // listen for connection closed event
      source.addEventListener('readystatechange', (event) => handleConnectionClosed(event, beforeTimestamp));

      source.stream();

      setSource(source);
    },
    [apiKey, handleChunkResponse, messages, model]
  );

  return { messages, submitStreamingPrompt, resetMessages, isLoading, closeStream };
};
