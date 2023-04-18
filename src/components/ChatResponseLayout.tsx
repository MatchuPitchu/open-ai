import type { ReactNode } from 'react';

interface IChat {
  isEmpty: boolean;
  children: ReactNode;
}

export const ChatResponseLayout = ({ isEmpty, children }: IChat) => {
  return (
    <section className="response">
      {isEmpty && <div>Noch keine Nachricht Chat</div>}
      {children}
    </section>
  );
};
