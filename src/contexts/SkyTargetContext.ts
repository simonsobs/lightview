import { createContext, use } from 'react';

/** A position the all-sky map should center on, e.g. the result of a SIMBAD catalog search. */
export type SkyTarget = {
  name: string;
  ra: number;
  dec: number;
  /** Unique per request, so searching the same object twice (after panning away) still
   * re-centers the map even though name/ra/dec are unchanged. */
  requestId: number;
};

type SkyTargetContextValue = {
  skyTarget: SkyTarget | null;
  goToSkyTarget: (target: Omit<SkyTarget, 'requestId'>) => void;
};

/** Bridges the navigation bar's Search (which resolves a target) and the home page's AllSkyMap
 * (which moves to it); they live in unrelated branches of the tree (see App.tsx). */
export const SkyTargetContext = createContext<SkyTargetContextValue>({
  skyTarget: null,
  goToSkyTarget: () => {},
});

export function useSkyTarget() {
  return use(SkyTargetContext);
}
