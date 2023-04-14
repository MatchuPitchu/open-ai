import { Configuration, OpenAIApi } from 'openai';
import { useMemo, useState } from 'react';
import type { OpenAIStreamingProps } from './useChatStream';
import type { ChatCompletionResponseMessage, ChatCompletionRequestMessage } from 'openai';

export const useChatCompletion = ({ model, apiKey }: OpenAIStreamingProps) => {
  const [isWorking, setIsWorking] = useState(false);
  const [chatCourse, setChatCourse] = useState<ChatCompletionResponseMessage[]>([]);

  const openai = useMemo(() => {
    const configuration = new Configuration({
      apiKey
    });

    return new OpenAIApi(configuration);
  }, [apiKey]);

  const submitCompletionPrompt = async (messages: ChatCompletionRequestMessage[]) => {
    try {
      setIsWorking(true);
      const completion = await openai.createChatCompletion({
        model,
        messages
      });

      const response = completion.data.choices[0].message;

      setChatCourse((prev) => {
        if (!response) return prev;
        return [...prev, response];
      });
    } catch (error) {
      console.error('Fehler beim Abfragen von OpenAI', error);
    }
    setIsWorking(false);
  };

  return { chatCourse, submitCompletionPrompt, isWorking };
};
