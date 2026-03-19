import { ChangeEvent, useCallback, useState } from 'react';
import { SourceStatistics, SourceSummary } from '../types';
import { Badge } from './Badge';
import './styles/source-page.css';
import { statsKeysToDisplaySpecs } from '../configs/stats';

type SourceHeaderProps = {
  name: string;
  ra: number;
  dec: number;
  stats: SourceSummary;
};

/**
 * Renders details about a source within the Source component
 */
export function SourceHeader({ name, ra, dec, stats }: SourceHeaderProps) {
  const freqs = Object.keys(stats);
  const [freq, setFreq] = useState(freqs[0]);
  const onFreqChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setFreq(e.target.value);
  }, []);

  const currStats: SourceStatistics = stats[freq];
  const currStatsKeys = Object.keys(currStats) as (keyof SourceStatistics)[];
  const statsKeysForDisplay = Object.keys(statsKeysToDisplaySpecs);
  return (
    <div className="source-header-container">
      <h3>{name}</h3>
      <label>
        Frequency
        <select value={freq} onChange={onFreqChange}>
          {freqs.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <div className="stats-container">
        <Badge label="RA" content={ra.toFixed(3)} />
        <Badge label="Dec" content={dec.toFixed(3)} />
        {currStatsKeys
          .filter((k) => statsKeysForDisplay.includes(k))
          .map((k) => (
            <Badge
              key={k}
              label={statsKeysToDisplaySpecs[k].label}
              content={
                format(k, currStats[k]) +
                ' ' +
                (statsKeysToDisplaySpecs[k].units ?? '')
              }
            />
          ))}
      </div>
    </div>
  );
}

function format(key: string, stat: number | string) {
  if (typeof stat === 'string') return stat;
  const sigFigs = statsKeysToDisplaySpecs[key].precision;
  if (sigFigs !== null) {
    return stat.toPrecision(sigFigs);
  } else {
    return stat;
  }
}
