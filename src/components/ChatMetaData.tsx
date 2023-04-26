import type { ChatRole } from '@/hooks/useOpenAIChatStream';
import { formatDate } from '@/utils/utils';

interface IChatMetaData {
  timestamp: number;
  role: ChatRole;
  tokens: number;
  responseTime: string;
}

export const ChatMetaData = ({ timestamp, role, tokens, responseTime }: IChatMetaData) => {
  return (
    <div className="response__meta-data">
      <div>Zeit: {formatDate(new Date(timestamp))}</div>
      {role === 'assistant' && (
        <>
          <div>Tokens: {tokens}</div>
          <div>Antwort Zeit: {responseTime}</div>
        </>
      )}
    </div>
  );
};
