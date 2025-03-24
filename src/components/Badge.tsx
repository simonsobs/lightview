import { ReactNode } from 'react';
import './styles/source-page.css';

type BadgeProps = {
  label: ReactNode;
  content: ReactNode;
};

export function Badge({ label, content }: BadgeProps) {
  return (
    <div className="badge-container">
      <h4>{label}</h4>
      <span>{content}</span>
    </div>
  );
}
