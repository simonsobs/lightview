import { ChangeEvent, useCallback, useState } from 'react';
import { SourceStatistics, SourceSummary } from '../types';
import { Badge } from './Badge';
import './styles/source-page.css';
import { statsKeysToDisplaySpecs } from '../configs/stats';
import { useQuery } from '../hooks/useQuery';
import { lightcurveApi } from '../api/client';

type SourceHeaderProps = {
  sourceId: string;
  name: string;
  ra: number;
  dec: number;
};

/**
 * Renders details about a source within the Source component
 */
export function SourceHeader({ sourceId, name, ra, dec }: SourceHeaderProps) {
  const [freq, setFreq] = useState<string | undefined>(undefined);
  const onFreqChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setFreq(e.target.value);
  }, []);

  const { data: sourceSummary, error: sourceSummaryError } = useQuery<
    SourceSummary | undefined
  >({
    initialData: undefined,
    queryKey: [sourceId, setFreq],
    queryFn: async () => {
      const res = await lightcurveApi.getSourceSummary(sourceId);
      setFreq(Object.keys(res)[0]);
      return res;
    },
  });

  if (sourceSummaryError) {
    throw sourceSummaryError;
  }

  if (!sourceSummary || !freq)
    return (
      <div className="source-header-container">
        <h4>Loading...</h4>
      </div>
    );

  const freqs = Object.keys(sourceSummary);
  const currStats: SourceStatistics = sourceSummary[freq];
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
