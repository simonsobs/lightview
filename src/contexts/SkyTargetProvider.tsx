import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import {
  SkyTarget,
  SkyTargetContext,
  SkyTargetRequest,
} from './SkyTargetContext';

/** Holds the current SkyTarget in its own component so a new target only re-renders the
 * context's consumers, not the whole App tree passed in as children. */
export function SkyTargetProvider({ children }: { children: ReactNode }) {
  const [skyTarget, setSkyTarget] = useState<SkyTarget | null>(null);
  const nextRequestIdRef = useRef(0);

  const goToSkyTarget = useCallback((target: SkyTargetRequest) => {
    nextRequestIdRef.current += 1;
    setSkyTarget({ ...target, requestId: nextRequestIdRef.current });
  }, []);

  const value = useMemo(
    () => ({ skyTarget, goToSkyTarget }),
    [skyTarget, goToSkyTarget]
  );

  return <SkyTargetContext value={value}>{children}</SkyTargetContext>;
}
