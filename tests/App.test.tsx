import { MemoryRouter } from 'react-router';
import { render, screen } from '@testing-library/react';
import { describe, it } from 'vitest';

import App from '../src/App';

describe('App', () => {
  it('renders App component', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    screen.debug();
  });
});
