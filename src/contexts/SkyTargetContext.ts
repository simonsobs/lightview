import { createContext, use } from 'react';

/** A position the all-sky map should center on, from one of the navigation bar's searches:
 * - 'object': a named object resolved by SIMBAD; the map zooms to a fixed field of view.
 * - 'cone': a cone search; the map zooms to fit the whole cone, which is also drawn as a circle. */
export type SkyTargetRequest =
  | { kind: 'object'; name: string; ra: number; dec: number }
  | { kind: 'cone'; ra: number; dec: number; radiusDeg: number };

export type SkyTarget = SkyTargetRequest & {
  /** Unique per request, so repeating a search (after panning away) still re-centers the map
   * even though its position is unchanged. */
  requestId: number;
};

type SkyTargetContextValue = {
  skyTarget: SkyTarget | null;
  goToSkyTarget: (target: SkyTargetRequest) => void;
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
