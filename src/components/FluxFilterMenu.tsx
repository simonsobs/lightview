import { useMemo, useState } from 'react';
import { Range as ReactRange, getTrackBackground } from 'react-range';
import { MIN_MAX_FLUX_VALUES } from '../configs/constants';
import type { SkySource } from './AllSkyMap';
import TooltipButton from './TooltipButton';

interface FluxFilterMenuProps {
  sources: SkySource[];
  bands: Set<string>;
  initialBand: string;
  initialRange: number[];
  onApply: (band: string, range: number[]) => void;
  onClear: () => void;
  onClose: () => void;
}

/** Clamps a source's number input to the slider's bounds, falling back to the previous
 * value on non-numeric input (e.g. while the field is momentarily empty) instead of letting
 * NaN silently break every flux comparison. */
function clampFluxInput(rawValue: string, previousValue: number): number {
  const parsed = Number(rawValue);
  if (Number.isNaN(parsed)) return previousValue;
  return Math.min(
    Math.max(parsed, MIN_MAX_FLUX_VALUES[0]),
    MIN_MAX_FLUX_VALUES[1]
  );
}

/**
 * The popup menu for choosing a frequency band + median flux range to filter the all-sky map
 * by. Keeps its own in-progress ("pending") selections local so dragging the slider only
 * re-renders this menu, not the rest of the map - see SourceFluxFilter for how it's mounted.
 */
export default function FluxFilterMenu({
  sources,
  bands,
  initialBand,
  initialRange,
  onApply,
  onClear,
  onClose,
}: FluxFilterMenuProps) {
  const [pendingBand, setPendingBand] = useState(initialBand);
  const [pendingRange, setPendingRange] = useState(initialRange);

  const tempFilteredSources = useMemo(() => {
    if (pendingBand === '') return sources;
    return sources.filter((s) => {
      const flux = s.properties?.median_flux[pendingBand];
      return flux != null && flux >= pendingRange[0] && flux <= pendingRange[1];
    });
  }, [sources, pendingBand, pendingRange]);

  const disableApplyFilterBtn = pendingBand === '';

  const trackBackground = useMemo(() => {
    return getTrackBackground({
      values: pendingRange,
      colors: ['#ccc', '#548BF4', '#ccc'],
      min: MIN_MAX_FLUX_VALUES[0],
      max: MIN_MAX_FLUX_VALUES[1],
    });
  }, [pendingRange]);

  return (
    <div className="flux-filter-menu">
      <button
        type="button"
        onClick={onClose}
        className="close-flux-menu-btn"
        aria-label="Close filter menu"
      >
        ❌
      </button>
      <label>
        Frequency band
        <select
          aria-label="Frequency band"
          value={pendingBand}
          onChange={(e) => setPendingBand(e.target.value)}
        >
          <option key="default" value="">
            Select a band...
          </option>
          {Array.from(bands).map((b) => (
            <option value={b} key={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
      <label>Median flux range (Jy)</label>
      <ReactRange
        values={pendingRange}
        min={MIN_MAX_FLUX_VALUES[0]}
        max={MIN_MAX_FLUX_VALUES[1]}
        step={0.001}
        onChange={(vals) => setPendingRange(vals)}
        renderThumb={({ props, isDragged }) => {
          const { key, ...thumbProps } = props;
          return (
            <div
              key={key}
              {...thumbProps}
              style={{
                ...thumbProps.style,
                height: '20px',
                width: '20px',
                borderRadius: '4px',
                backgroundColor: '#FFF',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 0 5px #bbb',
              }}
            >
              <div
                style={{
                  height: '10px',
                  width: '3px',
                  backgroundColor: isDragged ? '#548BF4' : '#CCC',
                }}
              />
            </div>
          );
        }}
        renderTrack={({ props, children }) => (
          <div
            onMouseDown={props.onMouseDown}
            onTouchStart={props.onTouchStart}
            style={{
              ...props.style,
              height: '12px',
              display: 'flex',
              margin: '10px 20px',
              zIndex: 2,
            }}
          >
            <div
              ref={props.ref}
              style={{
                height: '5px',
                width: '100%',
                borderRadius: '4px',
                background: trackBackground,
                alignSelf: 'center',
              }}
            >
              {children}
            </div>
          </div>
        )}
      />
      <div className="min-max-inputs">
        <label>
          Min
          <input
            min={MIN_MAX_FLUX_VALUES[0]}
            max={MIN_MAX_FLUX_VALUES[1]}
            type="number"
            onChange={(e) =>
              setPendingRange((prev) => [
                clampFluxInput(e.target.value, prev[0]),
                prev[1],
              ])
            }
            value={pendingRange[0]}
            step={0.001}
          />
        </label>
        <span>to</span>
        <label>
          Max
          <input
            min={MIN_MAX_FLUX_VALUES[0]}
            max={MIN_MAX_FLUX_VALUES[1]}
            type="number"
            onChange={(e) =>
              setPendingRange((prev) => [
                prev[0],
                clampFluxInput(e.target.value, prev[1]),
              ])
            }
            value={pendingRange[1]}
            step={0.001}
          />
        </label>
      </div>
      <span className="temp-filters-details">
        {tempFilteredSources.length} of {sources.length} sources match
      </span>
      <div className="filter-btns-container">
        <TooltipButton
          buttonClassName={
            'flux-filter-btn apply-filter-btn' +
            (disableApplyFilterBtn ? ' disabled' : '')
          }
          tooltipClassName="flux-filter-btn-tooltip apply"
          tooltipText={
            disableApplyFilterBtn
              ? 'Select a frequency band'
              : 'Apply and close menu'
          }
          onClick={() => {
            if (disableApplyFilterBtn) return;
            onApply(pendingBand, pendingRange);
            onClose();
          }}
          disabled={disableApplyFilterBtn}
        >
          Apply filter
        </TooltipButton>
        <TooltipButton
          buttonClassName="flux-filter-btn clear"
          tooltipClassName="flux-filter-btn-tooltip clear"
          tooltipText="Clear and reset filters"
          onClick={() => {
            setPendingBand('');
            setPendingRange(MIN_MAX_FLUX_VALUES);
            onClear();
          }}
        >
          Clear filter
        </TooltipButton>
      </div>
    </div>
  );
}
