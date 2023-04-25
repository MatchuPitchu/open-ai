import { Fragment, useRef } from 'react';
import { useChatCompletion } from '../hooks/useChatCompletion';
import { ChatContent } from './ChatContent';
import { ChatResponseLayout } from './ChatResponseLayout';
import { Role } from './Role';

export const ChatNonStreamingCompletion = () => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // V2 Single Response without Context Memory
  const { chatCourse, submitCompletionPrompt, isLoading } = useChatCompletion({
    model: 'gpt-3.5-turbo',
    apiKey: import.meta.env.VITE_OPEN_AI_KEY
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;

    if (!inputRef.current) return;

    submitCompletionPrompt([{ role: 'user', content: inputRef.current.value }]);
  };

  return (
    <>
      <form className="form" onSubmit={handleSubmit}>
        <textarea className="form__textarea" ref={inputRef} />
        <div className="form__buttons">
          <button type="submit" className="button">
            Submit
          </button>
        </div>
      </form>

      <ChatResponseLayout isEmpty={chatCourse.length === 0}>
        {chatCourse.length > 0 &&
          chatCourse.map(({ role, content }, index) => (
            <Fragment key={index}>
              <Role role={role} />
              <ChatContent text={[content]} />
            </Fragment>
          ))}
      </ChatResponseLayout>
    </>
  );
};
