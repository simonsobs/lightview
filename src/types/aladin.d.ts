interface Aladin {
  gotoRaDec: (ra: number, dec: number) => void;
}

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
  init: Promise<void>;
}

interface Window {
  A?: AladinStatic;
}
