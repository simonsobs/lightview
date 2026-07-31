import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ToggleSwitch } from '../../src/components/ToggleSwitch';

describe('ToggleSwitch', () => {
  it('renders the checked/unchecked labels and reflects the checked prop', () => {
    render(
      <ToggleSwitch
        toggleId="strategy"
        checked={true}
        onChange={() => {}}
        disabled={false}
        checkedLabel="On"
        uncheckedLabel="Off"
      />
    );

    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('calls onChange when toggled', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ToggleSwitch
        toggleId="strategy"
        checked={false}
        onChange={handleChange}
        disabled={false}
        checkedLabel="On"
        uncheckedLabel="Off"
      />
    );

    await user.click(screen.getByRole('checkbox'));

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('disables the checkbox and shows the disabled message as a title when disabled', () => {
    render(
      <ToggleSwitch
        toggleId="strategy"
        checked={false}
        onChange={() => {}}
        disabled={true}
        disabledMessage="Not available for this source"
        checkedLabel="On"
        uncheckedLabel="Off"
      />
    );

    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(
      screen.getByTitle('Not available for this source')
    ).toBeInTheDocument();
  });

  it('does not fire onChange when disabled', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ToggleSwitch
        toggleId="strategy"
        checked={false}
        onChange={handleChange}
        disabled={true}
        checkedLabel="On"
        uncheckedLabel="Off"
      />
    );

    await user.click(screen.getByRole('checkbox'));

    expect(handleChange).not.toHaveBeenCalled();
  });
});
