import { useEffect, useState } from 'react';
import { Checkmark } from '@/svg/Checkmark';
import { CopyIcon } from '@/svg/CopyIcon';
import classes from './Clipboard.module.css';

interface IClipboard {
  language: string;
  text: string;
}

export const Clipboard = ({ language, text }: IClipboard) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleClipboard = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
    } catch (error) {
      console.error('Can not write to clipboard', error);
    }
  };

  useEffect(() => {
    if (!isCopied) return;
    const timerId = setTimeout(() => setIsCopied(false), 3000);

    return () => clearTimeout(timerId);
  }, [isCopied]);

  return (
    <div className={classes.clipboard}>
      <span className={classes.clipboard__language}>{language}</span>
      <button className={classes.clipboard__button} onClick={handleClipboard} aria-label="copy">
        <CopyIcon className={`${classes['svg-copy']} ${isCopied ? classes.hide : ''}`} />
        <Checkmark className={`${classes['svg-checkmark']} ${isCopied ? classes.active : ''}`} />
      </button>
    </div>
  );
};
