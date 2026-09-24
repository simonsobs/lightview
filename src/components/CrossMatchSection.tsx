import { SIMBAD_BASE_LINK_OUT_URL } from '../configs/constants';
import { Link } from 'react-router';

type CrossMatchSectionProps = {
  crossMatches?: { name: string }[];
};

export function CrossMatchSection({ crossMatches }: CrossMatchSectionProps) {
  return (
    <div>
      <h3 className="source-section-h3">Cross-Matches</h3>
      {crossMatches?.length ? (
        <ul className="source-crossmatch-ul">
          {crossMatches.map((m) => (
            <li key={m.name} className="source-crossmatch-li">
              <Link
                target="_blank"
                className="link-outs"
                to={SIMBAD_BASE_LINK_OUT_URL + m.name}
              >
                {m.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <h4 className="source-crossmatch-no-results">
          <em>No results</em>
        </h4>
      )}
    </div>
  );
}
