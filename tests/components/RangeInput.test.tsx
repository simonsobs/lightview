import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { RangeInput } from '../../src/components/RangeInput';

describe('RangeInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the label, default value, and units', () => {
    render(
      <RangeInput
        min={0}
        max={10}
        defaultValue={3}
        units="deg"
        label="Radius"
        onFinalChange={() => {}}
      />
    );

    const paragraph = screen.getByText(
      (_, el) => el?.tagName === 'P' && el.textContent === 'Radius 3 deg'
    );
    expect(paragraph).toBeInTheDocument();
  });

  it('updates the displayed value on change without immediately calling onFinalChange', () => {
    const onFinalChange = vi.fn();

    render(
      <RangeInput
        min={0}
        max={10}
        defaultValue={0}
        onFinalChange={onFinalChange}
        label="Radius"
      />
    );

    fireEvent.change(screen.getByRole('slider'), { target: { value: '7' } });

    expect(screen.getByRole('slider')).toHaveValue('7');
    expect(onFinalChange).not.toHaveBeenCalled();
  });

  it('calls onFinalChange with the committed value after the debounce delay', () => {
    const onFinalChange = vi.fn();

    render(
      <RangeInput
        min={0}
        max={10}
        defaultValue={0}
        onFinalChange={onFinalChange}
        label="Radius"
      />
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '7' } });
    fireEvent.mouseUp(slider);

    expect(onFinalChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(onFinalChange).toHaveBeenCalledTimes(1);
    expect(onFinalChange).toHaveBeenCalledWith(7);
  });

  it('debounces rapid commits into a single call with the latest value', () => {
    const onFinalChange = vi.fn();

    render(
      <RangeInput
        min={0}
        max={10}
        defaultValue={0}
        onFinalChange={onFinalChange}
        label="Radius"
      />
    );

    const slider = screen.getByRole('slider');

    fireEvent.change(slider, { target: { value: '3' } });
    fireEvent.mouseUp(slider);
    vi.advanceTimersByTime(50);

    fireEvent.change(slider, { target: { value: '9' } });
    fireEvent.mouseUp(slider);
    vi.advanceTimersByTime(100);

    expect(onFinalChange).toHaveBeenCalledTimes(1);
    expect(onFinalChange).toHaveBeenCalledWith(9);
  });
});
