import { Configuration, OpenAIApi } from 'openai';
import { useMemo, useState } from 'react';
import type { OpenAIStreamingProps } from './useOpenAIChatStream';
import type { ChatCompletionResponseMessage, ChatCompletionRequestMessage } from 'openai';

export const useChatCompletion = ({ model, apiKey }: OpenAIStreamingProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [chatCourse, setChatCourse] = useState<ChatCompletionResponseMessage[]>([]);

  const openai = useMemo(() => {
    const configuration = new Configuration({
      apiKey
    });

    return new OpenAIApi(configuration);
  }, [apiKey]);

  const submitCompletionPrompt = async (messages: ChatCompletionRequestMessage[]) => {
    try {
      setIsLoading(true);
      const completion = await openai.createChatCompletion({
        model,
        messages
      });

      const response = completion.data.choices[0].message;
      if (!response) return;

      setChatCourse((prev) => [...prev, response]);
    } catch (error) {
      console.error('Fehler beim Abfragen von OpenAI', error);
    }
    setIsLoading(false);
  };

  return { chatCourse, submitCompletionPrompt, isLoading };
};
