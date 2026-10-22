import { memo, useState } from 'react';
import FluxFilterMenu from './FluxFilterMenu';
import TooltipButton from './TooltipButton';
import type { SkySource } from '../types';
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
 * range: the source count and filter status, the button that opens the filter menu,
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
        {/* Counts sources across the whole sky. The number depends only on the filter, unlike the table's 
          count below the map, which follows the map's view */}
        <p className="active-filter-count">
          {hasActiveFilter
            ? `${visibleCount.toLocaleString()} of ${sources.length.toLocaleString()} sources match`
            : `${sources.length.toLocaleString()} sources`}
        </p>
        {/* Always rendered, so the header keeps its height when a filter is applied or cleared */}
        <div className="active-filter-subtitle-container">
          {hasActiveFilter ? (
            <>
              <p className="active-filter-details subtitle-text">
                Filtered on {appliedBand} from {appliedRange[0]} to{' '}
                {appliedRange[1]} mJy
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
            </>
          ) : (
            <p className="active-filter-details subtitle-text">
              No filter applied
            </p>
          )}
        </div>
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
