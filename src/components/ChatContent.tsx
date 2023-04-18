import { Fragment } from 'react';
import type { ReactNode } from 'react';

interface IChatContent {
  text: (string | JSX.Element)[];
  children?: ReactNode;
}

export const ChatContent = ({ text, children }: IChatContent) => {
  return (
    <div className="response__content-box">
      <pre className="response__text">
        {text.map((content, index) => (
          <Fragment key={index}>{content}</Fragment>
        ))}
      </pre>
      {children}
    </div>
  );
};
