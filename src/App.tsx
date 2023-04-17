import { Fragment, useReducer, useRef } from 'react';
import { useChatStream } from './hooks/useChatStream';
import { formatDate, getFormattedText, setCSSVariable } from './utils/utils';
import type { FormEvent } from 'react';
import './App.css';

// TODO: Context Infos (Verlauf speichern) - Achtung: sind mehr Token und kostet mehr
// // TODO: API response streamen
// TODO: prompts templates für typische Fälle und ich dann nur Input values ausfüllen
// TODO: add model select button mit Hinweis und Link Pricing OpenAI: gpt-4 is more expensive
// TODO: model 3.5 für tests nutzen, da günstiger: https://openai.com/pricing

const SYNTAX_HIGHLIGHTING_PROMPT = '\n\nUse triple backticks for syntax highlighting for the code snippets';

export const App = () => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [shouldHighlightSyntax, toggleHighlightSyntax] = useReducer((prev) => !prev, false);

  // V2 Response Streaming with Context Memory
  const { messages, submitStreamingPrompt, resetMessages, isLoading, closeStream } = useChatStream({
    model: 'gpt-3.5-turbo',
    apiKey: import.meta.env.VITE_OPEN_AI_KEY
  });

  const handleResizeInput = () => {
    if (!inputRef.current || !formRef.current) return;
    inputRef.current.style.height = `auto`;

    inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;

    setCSSVariable('--response-after-height', `${formRef.current.offsetHeight}px`);
  };

  const updateInputField = (prompt: string) => {
    if (!inputRef.current) return;
    inputRef.current.value = prompt;
    handleResizeInput();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!inputRef.current) return;

    const input = inputRef.current.value.trimEnd();
    const syntaxHighlightingText =
      shouldHighlightSyntax && input.includes(SYNTAX_HIGHLIGHTING_PROMPT) ? '' : SYNTAX_HIGHLIGHTING_PROMPT;
    const prompt = `${input} ${syntaxHighlightingText}`;

    submitStreamingPrompt([{ role: 'user', content: prompt }]);

    updateInputField(prompt);
  };

  return (
    <>
      <main className="app">
        <section className="response">
          {messages.length === 0 && <div>Noch keine Nachricht im Chat (Streaming)</div>}

          {messages.length > 0 &&
            messages.map((message, index) => {
              const formattedText = getFormattedText(message.content);

              return (
                <Fragment key={index}>
                  <div className="response__role">
                    <span className="response__sticky">{message.role === 'assistant' ? 'ChatGPT' : 'User'}</span>
                  </div>
                  <div className="response__content-box">
                    <pre className="response__text">
                      {formattedText.map((content, index) => (
                        <Fragment key={index}>{content}</Fragment>
                      ))}
                    </pre>
                    {!message.meta.loading && (
                      <div className="response__meta-data">
                        <div>Zeit: {formatDate(new Date(message.timestamp))}</div>
                        {message.role === 'assistant' && (
                          <>
                            <div>Tokens: {message.meta.chunks.length}</div>
                            <div>Antwort Zeit: {message.meta.responseTime}</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </Fragment>
              );
            })}
        </section>
      </main>
      <form className="form" ref={formRef} onSubmit={handleSubmit}>
        <textarea
          className="form__textarea"
          ref={inputRef}
          placeholder="Schreibe eine Nachricht ..."
          autoFocus
          spellCheck={false}
          onInput={handleResizeInput}
        />
        <div className="form__buttons">
          <button
            type="submit"
            className="button"
            disabled={messages.length > 0 && messages[messages.length - 1].meta.loading}
          >
            Submit
          </button>
          <button type="reset" className="button" onClick={resetMessages} disabled={isLoading}>
            Reset Context
          </button>
        </div>

        <div className="checkbox">
          <input
            className="checkbox__input"
            type="checkbox"
            id="syntax-highlighting"
            checked={shouldHighlightSyntax}
            onChange={toggleHighlightSyntax}
          />
          <label className="checkbox__label" htmlFor="syntax-highlighting">
            Add Syntax Highlighting
          </label>
        </div>
      </form>
      <button className={`button button--abort ${isLoading ? 'active' : ''}`} onClick={closeStream}>
        Abfrage abbrechen
      </button>
    </>
  );
};
