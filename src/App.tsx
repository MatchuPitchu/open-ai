import { Fragment } from 'react';
import { ChatContent } from './components/ChatContent';
import { ChatForm } from './components/ChatForm';
import { ChatMetaData } from './components/ChatMetaData';
import { Role } from './components/Role';
import { useChatStream } from './hooks/useChatStream';
import { getFormattedText } from './utils/utils';
import './App.css';

// TODO: Context Infos (Verlauf speichern) - Achtung: sind mehr Token und kostet mehr
// TODO: prompts templates für typische Fälle und ich dann nur Input values ausfüllen
// TODO: add model select button mit Hinweis und Link Pricing OpenAI: gpt-4 is more expensive
// TODO: model 3.5 für tests nutzen, da günstiger: https://openai.com/pricing

export const App = () => {
  // V2 Response Streaming with Context Memory
  const { messages, submitPrompt, resetMessages, isLoading, closeStream } = useChatStream({
    model: 'gpt-3.5-turbo',
    apiKey: import.meta.env.VITE_OPEN_AI_KEY
  });

  return (
    <>
      <main className="app">
        <section className="response">
          {messages.length === 0 && <div>Noch keine Nachricht im Chat (Streaming)</div>}

          {messages.length > 0 &&
            messages.map(({ role, content, meta, timestamp }, index) => {
              const formattedText = getFormattedText(content);

              return (
                <Fragment key={index}>
                  <Role role={role} />
                  <div className="response__content-box">
                    <ChatContent text={formattedText} />
                    {!meta.loading && (
                      <ChatMetaData
                        timestamp={timestamp}
                        role={role}
                        tokens={meta.chunks.length}
                        responseTime={meta.responseTime}
                      />
                    )}
                  </div>
                </Fragment>
              );
            })}
        </section>
      </main>

      <ChatForm onSubmit={submitPrompt} onReset={resetMessages} isLoading={isLoading} />

      <button className={`button button--abort ${isLoading ? 'active' : ''}`} onClick={closeStream}>
        Abfrage abbrechen
      </button>
    </>
  );
};
