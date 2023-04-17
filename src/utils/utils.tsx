import { CodeBlock } from '../components/CodeBlock';
import { Highlight } from '../components/Highlight';

const BACKTICKS_REGEX = /`{3}/;
const SINGLE_BACKTICKS_REGEX = /`(?!`+)/;
const LANGUAGE_IN_CODE_BLOCK_REGEX = /^\w+(?=\n)/;

export const formatDate = (date: Date) =>
  date.toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  });

export const setCSSVariable = (key: string, value: string) => {
  document.documentElement.style.setProperty(key, value);
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

export const getFormattedText = (text: string) => {
  let formattedText = addCodeBlocks(text);

  if (SINGLE_BACKTICKS_REGEX.test(text)) {
    formattedText = addHighlighting(formattedText);
  }

  return formattedText;
};
