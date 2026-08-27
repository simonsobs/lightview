import { memo, useState } from 'react';
import FluxFilterMenu from './FluxFilterMenu';
import TooltipButton from './TooltipButton';
import type { SkySource } from './AllSkyMap';
import './styles/flux-filter.css';

interface SourceFluxFilterProps {
  sources: SkySource[];
  bands: Set<string>;
  visibleCount: number;
  appliedBand: string;
  appliedRange: number[];
  onApply: (band: string, range: number[]) => void;
  onClear: () => void;
}

/**
 * Header controls for filtering the all-sky map's sources by frequency band + median flux
 * range: the "N of M sources" / active-filter summary, the button that opens the filter menu,
 * and the menu itself. Memoized because AllSkyMap re-renders on every hovered-marker change
 * (mousemove over the sky map), which has nothing to do with this filter UI.
 */
function SourceFluxFilter({
  sources,
  bands,
  visibleCount,
  appliedBand,
  appliedRange,
  onApply,
  onClear,
}: SourceFluxFilterProps) {
  const [showFluxFilter, setShowFluxFilter] = useState(false);
  const hasActiveFilter = appliedBand !== '';

  return (
    <>
      <div className="filter-details-container">
        <p className="active-filter-count">
          Showing {visibleCount} of {sources.length} sources
        </p>
        {hasActiveFilter && (
          <div className="active-filter-subtitle-container">
            <p className="active-filter-details subtitle-text">
              Filtered on {appliedBand} from {appliedRange[0]} to{' '}
              {appliedRange[1]} Jy
            </p>
            <TooltipButton
              buttonClassName="clear-filter-btn"
              tooltipClassName="clear-filter-btn-tooltip"
              tooltipText="Clear filter"
              ariaLabel="Clear filter"
              onClick={onClear}
            >
              ❌
            </TooltipButton>
          </div>
        )}
      </div>
      <div className="flux-filter-controls">
        <div className="flux-filter-btn-container">
          <TooltipButton
            buttonClassName="flux-filter-btn"
            tooltipClassName="flux-filter-btn-tooltip"
            tooltipText="Open the filter menu"
            onClick={() => setShowFluxFilter(true)}
          >
            Filter by median flux
          </TooltipButton>
        </div>
      </div>
      {showFluxFilter && (
        <FluxFilterMenu
          sources={sources}
          bands={bands}
          initialBand={appliedBand}
          initialRange={appliedRange}
          onApply={onApply}
          onClear={onClear}
          onClose={() => setShowFluxFilter(false)}
        />
      )}
    </>
  );
}

export default memo(SourceFluxFilter);
