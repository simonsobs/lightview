import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SourceFluxFilter from '../../src/components/SourceFluxFilter';
import { SkySource } from '../../src/types';

const sources: SkySource[] = Array.from({ length: 4500 }, (_, i) => ({
  sourceId: String(i),
  name: `S${i}`,
  ra: 0,
  dec: 0,
}));

function renderFilter(appliedBand: string, visibleCount: number) {
  return render(
    <SourceFluxFilter
      sources={sources}
      bands={new Set(['f090'])}
      visibleCount={visibleCount}
      appliedBand={appliedBand}
      appliedRange={[0.5, 2]}
      onApply={vi.fn()}
      onClear={vi.fn()}
    />
  );
}

describe('SourceFluxFilter header', () => {
  it('shows the total and "No filter applied" without a clear button when unfiltered', () => {
    renderFilter('', 4500);

    expect(screen.getByText('4,500 sources')).toBeInTheDocument();
    expect(screen.getByText('No filter applied')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Clear filter' })
    ).not.toBeInTheDocument();
  });

  it('shows how many sources match and the active filter when filtered', () => {
    renderFilter('f090', 250);

    expect(screen.getByText('250 of 4,500 sources match')).toBeInTheDocument();
    expect(
      screen.getByText('Filtered on f090 from 0.5 to 2 mJy')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear filter' })
    ).toBeInTheDocument();
    expect(screen.queryByText('No filter applied')).not.toBeInTheDocument();
  });
});
