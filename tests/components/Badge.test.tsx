import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Badge } from '../../src/components/Badge';

describe('Badge', () => {
  it('renders the label and content', () => {
    render(<Badge label="RA" content="123.456" />);

    expect(screen.getByRole('heading', { name: 'RA' })).toBeInTheDocument();
    expect(screen.getByText('123.456')).toBeInTheDocument();
  });

  it('renders ReactNode content, not just strings', () => {
    render(<Badge label="Status" content={<span>Active</span>} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
