import { Fragment, useRef } from 'react';
import { useChatCompletion } from './hooks/useChatCompletion';

export const ChatCompletion = () => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // V1 Single Response without Context Memory
  const { chatCourse, submitCompletionPrompt, isWorking } = useChatCompletion({
    model: 'gpt-3.5-turbo',
    apiKey: import.meta.env.VITE_OPEN_AI_KEY
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isWorking) return;

    if (!inputRef.current) return;

    submitCompletionPrompt([{ role: 'user', content: inputRef.current.value }]);
  };

  return (
    <>
      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea className="chat-form__textarea" ref={inputRef} />
        <div className="chat-form__buttons">
          <button type="submit" className="button">
            Submit
          </button>
        </div>
      </form>

      <section className="chat-response">
        {chatCourse.length === 0 && <div>Noch keine Nachricht Chat (non Streaming)</div>}

        {chatCourse.map((chatResponse, index) => (
          <Fragment key={index}>
            <div className="chat-response__role">{chatResponse.role === 'assistant' ? 'ChatGPT' : 'User'}</div>
            <div className="chat-response__content">
              <pre className="chat-response__response">{chatResponse.content}</pre>
            </div>
          </Fragment>
        ))}
      </section>
    </>
  );
};
