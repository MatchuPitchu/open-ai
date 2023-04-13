import { Configuration, OpenAIApi } from 'openai';
import { Fragment, useRef, useState } from 'react';
import type { ChatCompletionResponseMessage } from 'openai';
import './App.css';

const configuration = new Configuration({
  apiKey: import.meta.env.VITE_OPEN_AI_KEY
});
const openai = new OpenAIApi(configuration);

/*** List available models ***/
// const listOfModels = await openai.listModels();

// TODO: Context Infos (Verlauf speichern) - Achtung: sind mehr Token und kostet mehr
// TODO: API response streamen
// TODO: prompts templates für typische Fälle und ich dann nur Input values ausfüllen
// TODO: add model select button mit Hinweis und Link Pricing OpenAI: gpt-4 is more expensive
// TODO: model 3.5 für tests nutzen, da günstiger: https://openai.com/pricing

export const App = () => {
  const [isWorking, setIsWorking] = useState(false);
  const [chatCourse, setChatCourse] = useState<ChatCompletionResponseMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isWorking || !inputRef.current || !inputRef.current.value) return;

    try {
      setIsWorking(true);
      const completion = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: inputRef.current.value }]
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

  return (
    <main className="app">
      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea className="chat-form__input" ref={inputRef} />
        <button type="submit" className="chat-form__button">
          Submit
        </button>
      </form>
      <section className="chat-response-list">
        {chatCourse.map((chatResponse, index) => (
          <Fragment key={index}>
            <div className="chat-response-list__role">{chatResponse.role === 'assistant' ? 'ChatGPT' : 'User'}</div>
            <div className="chat-response-list__content">{chatResponse.content}</div>
          </Fragment>
        ))}
      </section>
    </main>
  );
};
