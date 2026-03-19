import './styles/toggle-switch.css';
import { ChangeEvent, ReactNode } from 'react';

type ToggleSwitchProps = {
  toggleId: string;
  checked: boolean;
  onChange: (e: ChangeEvent) => void;
  disabled: boolean;
  disabledMessage?: string;
  checkedLabel: ReactNode;
  uncheckedLabel: ReactNode;
};

export function ToggleSwitch({
  toggleId,
  checked,
  onChange,
  disabled,
  disabledMessage,
  checkedLabel,
  uncheckedLabel,
}: ToggleSwitchProps) {
  return (
    <div
      className={'toggle-container' + (disabled ? ' disabled' : '')}
      title={disabled ? disabledMessage : undefined}
    >
      <input
        className="input"
        id={toggleId}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <label
        className={'label' + (disabled ? ' disabled' : '')}
        htmlFor={toggleId}
      >
        <div className="left">{uncheckedLabel}</div>
        <div className="switch">
          <span className="slider round"></span>
        </div>
        <div className="right">{checkedLabel}</div>
      </label>
    </div>
  );
}
