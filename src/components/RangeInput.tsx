import React, { useState, useRef, ReactNode } from 'react';
import './styles/range-input.css';

type Props = {
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  onFinalChange: (value: number) => void; // fired after user finishes
  label: ReactNode;
  units?: string;
};

export function RangeInput({
  min,
  max,
  step = 1,
  defaultValue = min,
  onFinalChange,
  label,
  units,
}: Props) {
  const [value, setValue] = useState<number>(defaultValue);
  const timeoutRef = useRef<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(Number(e.target.value));
  };

  const handleCommit = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Debounce the final action
    timeoutRef.current = window.setTimeout(() => {
      onFinalChange(value);
    }, 100); // adjust debounce delay as needed
  };

  return (
    <div className="range-input-container">
      <p>
        <span>{label}</span> {value} {units ?? ''}
      </p>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        step={step}
        onChange={handleChange}
        onMouseUp={handleCommit}
        onTouchEnd={handleCommit}
      />
    </div>
  );
}
