import { useState } from 'react';
import { SurveyStatus } from '../hooks/useSurveyStatus';
import './styles/webgl-context-lost.css';

type SurveyStatusNoticeProps = {
  status: SurveyStatus;
};

/** A small, dismissable notice over a sky map whose background survey is slow or unavailable (see
 * useSurveyStatus). Unlike SkyMapStatusOverlay, it leaves the map usable, since our sources still
 * plot without the background. Must be rendered inside the map's positioned host, like
 * SkyMapStatusOverlay. */
export function SurveyStatusNotice({ status }: SurveyStatusNoticeProps) {
  const [dismissedKind, setDismissedKind] = useState<
    SurveyStatus['kind'] | null
  >(null);
  // Once the survey recovers, forget the dismissal so a later problem is shown again
  if (status.kind === 'ok' && dismissedKind !== null) setDismissedKind(null);

  if (status.kind === 'ok' || status.kind === dismissedKind) return null;

  return (
    <div className="sky-survey-notice" role="status">
      <p>
        {status.kind === 'slow'
          ? 'Still waiting on the sky survey server, so the background imagery may not appear. Sources are still shown.'
          : `Background imagery isn't available because the sky survey server (${status.host}) isn't responding. Sources are still shown.`}
      </p>
      <button
        type="button"
        className="sky-survey-notice-dismiss"
        aria-label="Dismiss"
        onClick={() => setDismissedKind(status.kind)}
      >
        ×
      </button>
    </div>
  );
}
