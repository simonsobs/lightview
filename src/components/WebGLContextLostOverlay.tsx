import './styles/webgl-context-lost.css';

type WebGLContextLostOverlayProps = {
  onReload: () => void;
};

/** Covers a sky map whose WebGL context the browser killed (see useWebGLContextRecovery), so the
 * user sees why it stopped drawing and can rebuild it on demand. Must be rendered inside a
 * positioned ancestor (e.g. .webgl-context-lost-host) wrapping the map's container. */
export function WebGLContextLostOverlay({
  onReload,
}: WebGLContextLostOverlayProps) {
  return (
    <div className="webgl-context-lost-overlay" role="status">
      <p>
        This sky map was paused because too many maps and plots are open in
        other tabs. Closing some of those tabs can help.
      </p>
      <button
        type="button"
        className="webgl-context-lost-reload-button"
        onClick={onReload}
      >
        Reload map
      </button>
    </div>
  );
}
