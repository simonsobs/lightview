import { CSSProperties } from 'react';

type Props = {
  color?: CSSProperties['color'];
};

export function SearchIcon({ color = '#000' }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={color}>
      <path
        fillRule="evenodd"
        d="M10 2a8 8 0 0 1 5.29 13.71l4 4a1 1 0 1 1-1.42 1.42l-4-4A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 4.24 10.24A6 6 0 0 0 10 4Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
