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
}

interface Catalog {
  addSources: (markers: object[]) => unknown;
}

interface CatalogOptions {
  name: string;
  shape?: (
    source: { x: number; y: number },
    canvasCtx: CanvasRenderingContext2D
  ) => void;
  onClick?: string;
  color?: string;
  sourceSize?: number;
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
  init: Promise<void>;
}

/** Upon initialization, Aladin should be added to the Window object */
interface Window {
  A?: AladinStatic;
}
