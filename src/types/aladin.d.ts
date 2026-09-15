/**
 * Let's us type the Aladin plugin that we're using in the Source page.
 */

/**
 * Represents the Aladin class. The Aladin class has many more methods,
 * so add them here if/when we need them.
 *
 * Refer to the Aladin docs: https://cds-astro.github.io/aladin-lite/Aladin.html
 */
interface AladinClickedObject {
  data?: Record<string, unknown>;
  ra?: number;
  dec?: number;
}

type AladinSource = {
  data: {
    sourceId: string;
  };
  show: () => void;
  hide: () => void;
};

interface Aladin {
  gotoRaDec: (ra: number, dec: number) => void;
  addCatalog: (catalog: unknown) => void;
  setProjection: (projection: string) => void;
  setFov: (fovDegrees: number) => void;
  getFov: () => [number, number];
  /** Only the events we actually listen for are typed here; add more as needed. */
  on: {
    (
      event: 'objectClicked',
      callback: (object: AladinClickedObject) => void
    ): void;
    (
      event: 'objectHovered' | 'objectHoveredStop',
      callback: (
        object: AladinClickedObject,
        xyMouseCoords: { x: number; y: number }
      ) => void
    ): void;
  };
  /** Detaches every catalog/overlay layer added via addCatalog/addOverlay. */
  removeLayers: () => void;
  addOverlay: (overlay: GraphicOverlay) => void;
}

type CatalogShape =
  | 'circle'
  | 'square'
  | 'plus'
  | 'rhomb'
  | 'cross'
  | 'triangle'
  | ((
      source: { x: number; y: number },
      canvasCtx: CanvasRenderingContext2D
    ) => void);

interface Catalog {
  addSources: (markers: object[]) => unknown;
  getSources: () => AladinSource[];
  setShape: (shape: CatalogShape) => void;
}

interface CatalogOptions {
  name: string;
  shape?: CatalogShape;
  onClick?: string;
  color?: string;
  sourceSize?: number;
}

interface GraphicOverlayOptions {
  name?: string;
  color?: string;
  lineWidth?: number;
  /** [dash length, gap length] in pixels, e.g. [5, 4] for a dashed line. */
  lineDash?: number[];
}

interface GraphicOverlay {
  addFootprints: (footprints: object | object[]) => void;
}

interface MarkerOptions {
  popupTitle?: string;
  /** Rendered as raw HTML inside Aladin's own popup DOM (not React) - escape untrusted content
   * before passing it here. */
  popupDesc?: string;
  useMarkerDefaultIcon?: boolean;
}

/**
 * Represents the interface that initializes the Aladin plugin and adds it to the Window object.
 *
 * Refer to the Aladin docs if/when we need to amend the options:
 * https://cds-astro.github.io/aladin-lite/global.html#AladinOptions
 */
interface AladinStatic {
  aladin: (
    container: HTMLDivElement,
    options?: {
      survey?: string;
      fov?: number;
      cooFrame?: string;
      projection?: string;
    }
  ) => Aladin;
  catalog: (options: CatalogOptions) => Catalog;
  source: (ra: number, dec: number, options: unknown) => object;
  marker: (ra: number, dec: number, options?: MarkerOptions) => object;
  circle: (ra: number, dec: number, radiusDegrees: number) => object;
  graphicOverlay: (options: GraphicOverlayOptions) => GraphicOverlay;
  init: Promise<void>;
}

/** Upon initialization, Aladin should be added to the Window object */
interface Window {
  A?: AladinStatic;
}
