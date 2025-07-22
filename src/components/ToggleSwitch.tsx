import './styles/toggle-switch.css';
import { ReactNode } from 'react';

type ToggleSwitchProps = {
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  disabledMessage?: string;
  checkedLabel: ReactNode;
  uncheckedLabel: ReactNode;
};

export function ToggleSwitch({
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
        id="toggle"
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <label
        className={'label' + (disabled ? ' disabled' : '')}
        htmlFor="toggle"
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
