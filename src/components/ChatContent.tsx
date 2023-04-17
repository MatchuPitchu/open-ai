import { Fragment } from 'react';

interface IChatContent {
  text: (string | JSX.Element)[];
}

export const ChatContent = ({ text }: IChatContent) => {
  return (
    <pre className="response__text">
      {text.map((content, index) => (
        <Fragment key={index}>{content}</Fragment>
      ))}
    </pre>
  );
};
