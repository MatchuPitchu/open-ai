import { Fragment } from 'react';
import { ChatContent } from './components/ChatContent';
import { ChatForm } from './components/ChatForm';
import { ChatMetaData } from './components/ChatMetaData';
import { ChatResponseLayout } from './components/ChatResponseLayout';
import { Role } from './components/Role';
import { useChatStream } from './hooks/useChatStream';
import { getFormattedText } from './utils/utils';
import './App.css';

// TODO: Context Infos (Verlauf speichern) - Achtung: sind mehr Token und kostet mehr
// TODO: prompts templates für typische Fälle und ich dann nur Input values ausfüllen
// TODO: add model select button mit Hinweis und Link Pricing OpenAI: gpt-4 is more expensive
// TODO: model 3.5 für tests nutzen, da günstiger: https://openai.com/pricing

export const App = () => {
  // V1 Response Streaming with Context Memory
  const { messages, submitPrompt, resetMessages, isLoading, stopStream } = useChatStream({
    model: 'gpt-3.5-turbo',
    apiKey: import.meta.env.VITE_OPEN_AI_KEY
  });

  return (
    <>
      <main className="app">
        <ChatResponseLayout isEmpty={messages.length === 0}>
          {messages.length > 0 &&
            messages.map(({ role, content, meta, timestamp }, index) => (
              <Fragment key={index}>
                <Role role={role} />
                <ChatContent text={getFormattedText(content)}>
                  {!meta.loading && (
                    <ChatMetaData
                      timestamp={timestamp}
                      role={role}
                      tokens={meta.chunks.length}
                      responseTime={meta.responseTime}
                    />
                  )}
                </ChatContent>
              </Fragment>
            ))}
        </ChatResponseLayout>
      </main>

      <ChatForm onSubmit={submitPrompt} onReset={resetMessages} isLoading={isLoading} />

      <button className={`button button--abort ${isLoading ? 'active' : ''}`} onClick={stopStream}>
        Abfrage abbrechen
      </button>
    </>
  );
};
