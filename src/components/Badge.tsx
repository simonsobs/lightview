import { ReactNode } from 'react';
import './styles/source-page.css';

type BadgeProps = {
  label: ReactNode;
  content: ReactNode;
};

/**
 * A simple, styled Badge component that renders data with a label
 *
 * @param BadgeProps
 * @returns JSX.Element
 */
export function Badge({ label, content }: BadgeProps) {
  return (
    <div className="badge-container">
      <h4>{label}</h4>
      <span>{content}</span>
    </div>
  );
}
