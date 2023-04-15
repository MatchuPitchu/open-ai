import type { ReactNode } from 'react';

interface IHighlight {
  children: ReactNode;
}

export const Highlight = ({ children }: IHighlight) => {
  return <code className="code-highlight">{children}</code>;
};
