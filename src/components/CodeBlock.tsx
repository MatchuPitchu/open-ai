import { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Clipboard } from './Clipboard';
import classes from './CodeBlock.module.css';

interface ICodeBlock {
  code: string;
  language: string;
}

const process = (code = '') => {
  let skippedLeadingEmptyLines = false;
  let lastNonEmptyLineIndex = 0;
  let minRawStringIndentation = Number.MAX_SAFE_INTEGER;
  let numberOfRemovedLines = 0;

  const processNonEmptyLine = (line: string, index: number) => {
    // keep track of the index of the last non-empty line
    lastNonEmptyLineIndex = index - numberOfRemovedLines;
    // determine the minimum indentation level
    minRawStringIndentation = Math.min(minRawStringIndentation, Math.max(0, line.search(/\S/)));
    // return the processed line
    return [line.trimEnd()];
  };

  // split code into lines
  const codeLines = code.split('\n');

  // remove empty lines, and process non-empty lines
  const nonEmptyLinesAtStart = codeLines.flatMap((line, index) => {
    if (!skippedLeadingEmptyLines) {
      if (line.match(/^\s*$/)) {
        numberOfRemovedLines += 1;
        return [];
      }

      skippedLeadingEmptyLines = true;
      return processNonEmptyLine(line, index);
    }

    if (line.match(/^\s*$/)) return [''];

    return processNonEmptyLine(line, index);
  });

  const nonEmptyLinesStartAndEnd = nonEmptyLinesAtStart.slice(0, lastNonEmptyLineIndex + 1);

  // If there are no non-empty lines, return an empty string
  if (nonEmptyLinesStartAndEnd.length === 0) return '';

  const nonRawStringIndentationLines =
    minRawStringIndentation !== 0
      ? nonEmptyLinesStartAndEnd.map((line) => line.substring(minRawStringIndentation))
      : nonEmptyLinesStartAndEnd;

  return nonRawStringIndentationLines.join('\n');
};

export const CodeBlock = ({ code, language }: ICodeBlock) => {
  const [isReloaded, setIsReloaded] = useState(false);

  const processedCode = process(code);

  useEffect(() => {
    const timerId = setTimeout(() => setIsReloaded(true), 0);

    return () => clearTimeout(timerId);
  }, []);

  return isReloaded ? (
    <pre className={classes.pre}>
      <Clipboard language={language} text={processedCode} />
      <SyntaxHighlighter language={language} style={vscDarkPlus}>
        {processedCode}
      </SyntaxHighlighter>
    </pre>
  ) : null;
};
