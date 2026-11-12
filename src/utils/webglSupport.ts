let cachedIsWebGLAvailable: boolean | undefined;

/** Whether the browser can create a WebGL context, using the same check Plotly's scattergl does
 * before it gives up and covers the plot with its "WebGL is not supported" overlay. The result is
 * cached, and the probe context is released right away so it doesn't take up one of the browser's
 * limited context slots. */
export function isWebGLAvailable(): boolean {
  if (cachedIsWebGLAvailable !== undefined) return cachedIsWebGLAvailable;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    cachedIsWebGLAvailable = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cachedIsWebGLAvailable = false;
  }
  return cachedIsWebGLAvailable;
}
