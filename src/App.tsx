import { Fragment, useReducer, useRef } from 'react';
import { CodeBlock } from './components/CodeBlock';
import { Highlight } from './components/Highlight';
import { useChatStream } from './hooks/useChatStream';
import type { FormEvent } from 'react';
import './App.css';

// TODO: Context Infos (Verlauf speichern) - Achtung: sind mehr Token und kostet mehr
// // TODO: API response streamen
// TODO: prompts templates für typische Fälle und ich dann nur Input values ausfüllen
// TODO: add model select button mit Hinweis und Link Pricing OpenAI: gpt-4 is more expensive
// TODO: model 3.5 für tests nutzen, da günstiger: https://openai.com/pricing

const formatDate = (date: Date) =>
  date.toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  });

const BACKTICKS_REGEX = /`{3}/;
const SINGLE_BACKTICKS_REGEX = /`(?!`+)/;
const LANGUAGE_IN_CODE_BLOCK_REGEX = /^\w+(?=\n)/;

export const App = () => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [shouldHighlightSyntax, toggleHighlightSyntax] = useReducer((prev) => !prev, false);

  // V2 Response Streaming with Context Memory
  const { messages, submitStreamingPrompt, resetMessages, isLoading, closeStream } = useChatStream({
    model: 'gpt-3.5-turbo',
    apiKey: import.meta.env.VITE_OPEN_AI_KEY
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (inputRef.current?.value) {
      inputRef.current.value = `${inputRef.current.value} \n\n${
        shouldHighlightSyntax ? 'Use syntax highlighting for the code snippets.' : ''
      }`;

      submitStreamingPrompt([{ role: 'user', content: inputRef.current.value }]);
    }
  };

  const createCodeBlock = (block: string, language = '') => <CodeBlock code={block} language={language} />;
  const createHighlightBlock = (text: string) => <Highlight>{text}</Highlight>;

  const addHighlighting = (textBlocks: (string | JSX.Element)[]) => {
    return textBlocks.flatMap((part) => {
      if (typeof part !== 'string') return part;

      const formattedParts = part.split(SINGLE_BACKTICKS_REGEX).map((subPart, index) => {
        return index % 2 === 0 ? subPart : createHighlightBlock(subPart);
      });

      return formattedParts;
    });
  };

  const addCodeBlocks = (text: string) => {
    const blocks = text.split(BACKTICKS_REGEX);

    return blocks.map((part, index) => {
      if (index % 2 === 1) {
        const language = part.match(LANGUAGE_IN_CODE_BLOCK_REGEX)?.[0];
        if (language) {
          const partWithoutLanguage = part.replace(language, '');
          return createCodeBlock(partWithoutLanguage, language);
        }
      }

      return part;
    });
  };

  const getFormattedText = (text: string) => {
    let formattedText = addCodeBlocks(text);

    if (SINGLE_BACKTICKS_REGEX.test(text)) {
      formattedText = addHighlighting(formattedText);
    }

    return formattedText;
  };

  return (
    <>
      <main className="app">
        <form className="chat-form" onSubmit={handleSubmit}>
          <textarea
            className="chat-form__input"
            ref={inputRef}
            placeholder="Schreibe eine Nachricht ..."
            autoFocus
            spellCheck={false}
          />
          <div className="chat-form__buttons">
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

        <section className="chat-response-list">
          {messages.length === 0 && <div>Noch keine Nachricht im Chat (Streaming)</div>}

          {messages.length > 0 &&
            messages.map((message, index) => {
              const formattedText = getFormattedText(message.content);

              return (
                <Fragment key={index}>
                  <div className="chat-response-list__role">{message.role === 'assistant' ? 'ChatGPT' : 'User'}</div>
                  <div className="chat-response-list__content">
                    <pre className="chat-response-list__response">
                      {formattedText.map((content, index) => (
                        <Fragment key={index}>{content}</Fragment>
                      ))}
                    </pre>
                    {!message.meta.loading && (
                      <div className="meta-data">
                        <div className="meta-data__item">Zeit: {formatDate(new Date(message.timestamp))}</div>
                        {message.role === 'assistant' && (
                          <>
                            <div className="meta-data__item">Tokens: {message.meta.chunks.length}</div>
                            <div className="meta-data__item">Antwort Zeit: {message.meta.responseTime}</div>
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
      <button className={`button button--abort ${isLoading ? 'active' : ''}`} onClick={closeStream}>
        Abfrage abbrechen
      </button>
    </>
  );
};
