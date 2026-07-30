import { MemoryRouter } from 'react-router';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import App from '../src/App';

describe('App', () => {
  it('renders navigation and footer on unmatched routes', () => {
    render(
      <MemoryRouter initialEntries={['/some/unmatched/route']}>
        <App />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('link', { name: /SO Light Curve Viewer/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /the documentation/i })
    ).toBeInTheDocument();
  });

  it('renders the not-found page for an unmatched route', () => {
    render(
      <MemoryRouter initialEntries={['/some/unmatched/route']}>
        <App />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /page not found/i })
    ).toBeInTheDocument();
  });
});
