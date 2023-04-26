import { useReducer, useRef } from 'react';
import type { ChatMessageParams } from '@/hooks/useOpenAIChatStream';
import { setCSSVariable } from '@/utils/utils';
import type { FormEvent } from 'react';

interface IChatForm {
  onSubmit: (newPrompt: ChatMessageParams[]) => void;
  onReset: () => void;
  isLoading: boolean;
}

const SYNTAX_HIGHLIGHTING_PROMPT = '\n\nUse triple backticks for syntax highlighting for the code snippets';

const getSyntaxHighlightingText = (shouldHighlight: boolean, currentInput: string) => {
  if (currentInput.includes(SYNTAX_HIGHLIGHTING_PROMPT) || !shouldHighlight) {
    return '';
  }

  return SYNTAX_HIGHLIGHTING_PROMPT;
};

export const ChatForm = ({ onSubmit, onReset, isLoading }: IChatForm) => {
  const [shouldHighlightSyntax, toggleHighlightSyntax] = useReducer((prev) => !prev, false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleResizeInput = () => {
    if (!inputRef.current || !formRef.current) return;
    inputRef.current.style.height = `auto`;

    inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;

    setCSSVariable('--response-after-height', `${formRef.current.offsetHeight}px`);
  };

  const updateInputField = (prompt: string) => {
    if (!inputRef.current) return;
    inputRef.current.value = prompt;
    handleResizeInput();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!inputRef.current) return;

    const input = inputRef.current.value.trim();

    const syntaxHighlightingText = getSyntaxHighlightingText(shouldHighlightSyntax, input);
    const prompt = `${input} ${syntaxHighlightingText}`.trim();

    onSubmit([{ role: 'user', content: prompt }]);

    updateInputField(prompt);
  };

  return (
    <form className="form" ref={formRef} onSubmit={handleSubmit}>
      <textarea
        className="form__textarea"
        ref={inputRef}
        placeholder="Schreibe eine Nachricht ..."
        autoFocus
        spellCheck={false}
        onInput={handleResizeInput}
      />
      <div className="form__buttons">
        <button type="submit" className="button" disabled={isLoading}>
          Submit
        </button>
        <button type="reset" className="button" onClick={onReset} disabled={isLoading}>
          Reset Context
        </button>
      </div>

      <div className="checkbox">
        <input
          className="checkbox__input"
          type="checkbox"
          id="syntax-highlighting"
          checked={shouldHighlightSyntax}
          onChange={toggleHighlightSyntax}
        />
        <label className="checkbox__label" htmlFor="syntax-highlighting">
          Add Syntax Highlighting
        </label>
      </div>
    </form>
  );
};
