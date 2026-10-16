import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Search } from '../../src/components/Search';
import { SESAME_NOT_FOUND, sesameHit } from '../utils/sesameFixtures';
import {
  SkyTargetContext,
  SkyTarget,
} from '../../src/contexts/SkyTargetContext';

function textResponse(text: string) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(text),
  } as unknown as Response;
}

function renderSearch(
  goToSkyTarget: (t: Omit<SkyTarget, 'requestId'>) => void
) {
  return render(
    <MemoryRouter initialEntries={['/source/abc']}>
      <SkyTargetContext value={{ skyTarget: null, goToSkyTarget }}>
        <Search />
        <Routes>
          <Route index element={<p>home page</p>} />
          <Route path="/source/:id" element={<p>source page</p>} />
        </Routes>
      </SkyTargetContext>
    </MemoryRouter>
  );
}

describe('Search - catalog search via SIMBAD', () => {
  let fetchMock: Mock<typeof fetch>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    global.fetch = fetchMock;
  });

  async function searchFor(name: string) {
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox'), 'catalog-search');
    await user.type(screen.getByLabelText('Object name'), name);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    return user;
  }

  it('moves the map to the object, and goes home', async () => {
    fetchMock.mockResolvedValue(
      textResponse(sesameHit('M  31', 10.684708, 41.26875))
    );
    const goToSkyTarget = vi.fn();
    renderSearch(goToSkyTarget);

    await searchFor('m31');

    await waitFor(() =>
      expect(goToSkyTarget).toHaveBeenCalledWith({
        name: 'M 31',
        ra: 10.684708,
        dec: 41.26875,
      })
    );
    expect(screen.getByText('home page')).toBeInTheDocument();
  });

  it('shows SIMBAD lookup failures without moving the map', async () => {
    fetchMock.mockResolvedValue(textResponse(SESAME_NOT_FOUND));
    const goToSkyTarget = vi.fn();
    renderSearch(goToSkyTarget);

    await searchFor('nope');

    expect(
      await screen.findByText(/SIMBAD couldn't find an object named "nope"/)
    ).toBeInTheDocument();
    expect(goToSkyTarget).not.toHaveBeenCalled();
    expect(screen.getByText('source page')).toBeInTheDocument();
    // Kept so a typo can be corrected
    expect(screen.getByLabelText('Object name')).toHaveValue('nope');
  });

  it('shows network failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderSearch(vi.fn());

    await searchFor('M31');

    expect(
      await screen.findByText(/Couldn't reach SIMBAD/)
    ).toBeInTheDocument();
  });

  it('lets the error be dismissed', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderSearch(vi.fn());

    const user = await searchFor('M31');
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Dismiss error' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await searchFor('M31');
    await screen.findByRole('alert');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
