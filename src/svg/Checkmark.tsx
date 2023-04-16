import classes from './Checkmark.module.css';
import type { SVGProps } from 'react';

interface ICheckmark extends SVGProps<SVGSVGElement> {
  className?: string;
}

export const Checkmark = ({ className }: ICheckmark) => {
  return (
    <svg className={`${classes.svg} ${className ?? ''}`} viewBox="0 0 16 16">
      <path d="M13.5 2l-7.5 7.5-3.5-3.5-2.5 2.5 6 6 10-10z" />
    </svg>
  );
};
