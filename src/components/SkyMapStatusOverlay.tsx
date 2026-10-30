import { AladinLoadStatus } from '../utils/initAladin';
import './styles/webgl-context-lost.css';

type SkyMapStatusOverlayProps = {
  status: AladinLoadStatus;
};

/** Covers a sky map while Aladin is still loading, or with an error if it couldn't load (see
 * initAladin). Like WebGLContextLostOverlay, it must be rendered inside a positioned ancestor
 * (e.g. .webgl-context-lost-host) wrapping the map's container, so it sits over the map's
 * reserved space instead of stacking below it. */
export function SkyMapStatusOverlay({ status }: SkyMapStatusOverlayProps) {
  if (status === 'loading') {
    return (
      <div className="sky-map-loading" role="status">
        Loading sky map...
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="webgl-context-lost-overlay" role="alert">
        <p>
          The sky map couldn't be loaded. Check your connection, and that your
          browser supports WebGL2.
        </p>
        <button
          type="button"
          className="webgl-context-lost-reload-button"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
    );
  }

  return null;
}
