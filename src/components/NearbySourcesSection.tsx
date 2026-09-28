import { SourceResponse } from '../types';
import { angularSeparationDeg } from '../utils/angularSeparation';
import { RangeInput } from './RangeInput';
import { Link } from 'react-router';

type NearbySourcesProps = {
  sourceRa: number;
  sourceDec: number;
  nearbySources: SourceResponse[] | undefined;
  isLoading: boolean;
  error: Error | null;
  nearbySourceRadius: number;
  setNearbySourceRadius: (radius: number) => void;
};

/** Renders a Table of sources found within a cone search of x radius from a given source */
export function NearbySourcesSection({
  sourceRa,
  sourceDec,
  nearbySources,
  isLoading,
  error,
  nearbySourceRadius,
  setNearbySourceRadius,
}: NearbySourcesProps) {
  return (
    <div>
      <h3 className="source-section-h3">Nearby Sources</h3>
      <RangeInput
        min={0.1}
        max={5}
        step={0.1}
        defaultValue={nearbySourceRadius}
        onFinalChange={setNearbySourceRadius}
        label="Cone search radius:"
        units="degrees"
      />
      <div>
        {isLoading ? (
          <h4>Loading...</h4>
        ) : error ? (
          <h4>There was an error loading nearby sources.</h4>
        ) : nearbySources && nearbySources.length ? (
          <ul className="source-crossmatch-ul">
            {nearbySources.map((s) => (
              <li key={s.source_id} className="source-crossmatch-li">
                <Link
                  target="_blank"
                  className="link-outs"
                  to={'/source/' + s.source_id}
                >
                  {s.name}
                </Link>
                <p className="small-text">
                  {angularSeparationDeg(
                    sourceRa,
                    sourceDec,
                    s.ra,
                    s.dec
                  ).toFixed(2)}{' '}
                  arcmin
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <h4 className="source-crossmatch-no-results">
            <em>No results</em>
          </h4>
        )}
      </div>
    </div>
  );
}
