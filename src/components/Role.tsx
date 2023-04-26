import type { ChatRole } from '@/hooks/useOpenAIChatStream';

interface IRole {
  role: ChatRole;
}

export const Role = ({ role }: IRole) => {
  return (
    <div className="response__role">
      <span className="response__sticky">{role === 'assistant' ? 'ChatGPT' : 'User'}</span>
    </div>
  );
};
