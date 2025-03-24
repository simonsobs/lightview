import { SourceResponse } from '../types';
import { Badge } from './Badge';
import './styles/source-page.css';

type SourceHeaderProps = Omit<SourceResponse, 'variable'> & {
  sourceClass: string;
  maxFlux: number;
  medianFlux: number;
  freqForMaxAndMedian: string;
};

export function SourceHeader({
  id,
  ra,
  dec,
  sourceClass,
  maxFlux,
  medianFlux,
  freqForMaxAndMedian,
}: SourceHeaderProps) {
  return (
    <div className="source-header-container">
      <h3>SO-{id}</h3>
      <Badge label="RA" content={ra.toFixed(5)} />
      <Badge label="Dec" content={dec.toFixed(5)} />
      <Badge label="Class" content={sourceClass} />
      <Badge
        label={
          <>
            Max <span className="freq-aside">(at {freqForMaxAndMedian})</span>
          </>
        }
        content={maxFlux.toFixed(5) + ' MJy'}
      />
      <Badge
        label={
          <>
            Base <span className="freq-aside">(at {freqForMaxAndMedian})</span>
          </>
        }
        content={medianFlux.toFixed(5) + ' MJy'}
      />
    </div>
  );
}
