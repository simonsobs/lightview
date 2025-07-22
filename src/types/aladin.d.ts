/**
 * Let's us type the Aladin plugin that we're using in the Source page.
 */

/**
 * Represents the Aladin class. The Aladin class has many more methods,
 * so add them here if/when we need them.
 *
 * Refer to the Aladin docs: https://cds-astro.github.io/aladin-lite/Aladin.html
 */
interface Aladin {
  gotoRaDec: (ra: number, dec: number) => void;
  addCatalog: (catalog: unknown) => void;
}

interface Catalog {
  addSources: (markers: object[]) => unknown;
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
  catalog: (options: unknown) => Catalog;
  marker: (ra: number, dec: number, options: unknown) => object;
  init: Promise<void>;
}

/** Upon initialization, Aladin should be added to the Window object */
interface Window {
  A?: AladinStatic;
}
