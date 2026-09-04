import {
  FrequencyLightcurveData,
  InstrumentLightcurveData,
  SelectionStrategy,
  SourceResponse,
} from '../types';
import { useQuery } from '../hooks/useQuery';
import { Lightcurve } from './Lightcurve';
import { DEFAULT_HOMEPAGE_PLOT_LAYOUT } from '../configs/constants';
import { useNavigate } from 'react-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { lightcurveApi } from '../api/client';
import AllSkyMap, { SkySource } from './AllSkyMap';
import { LinkOutIcon } from './icons/LinkOutIcon';
import { CloseIcon } from './icons/CloseIcon';

/** Duration of the dialog's toast-like enter/exit transition; must match the CSS transition
 * duration on .home-light-curve in index.css; used as a fallback in case 'transitionend' never
 * fires (e.g. the element is removed mid-transition). */
const DIALOG_ANIM_DURATION_MS = 220;

type DialogPhase = 'closed' | 'entering' | 'open' | 'exiting';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Renders the "home" page of the web app */
export function Main() {
  const [selectionStrategy, setSelectionStrategy] =
    useState<SelectionStrategy>('instrument');
  // The animated inner wrapper (not the outer positioned container) - see dialogPhase below.
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  // Drives the dialog's toast-like enter/exit transition:
  // - 'closed': dialog is not shown.
  // - 'entering': dialog was just shown; about to transition from hidden -> visible.
  // - 'open': settled, fully visible.
  // - 'exiting': transitioning from visible -> hidden; on completion either actually closes the
  //   dialog, or (if a new marker was clicked while already open) swaps to the new source and
  //   re-enters, so a rapid marker-to-marker click always plays a full close-then-reopen cycle
  //   instead of an abrupt in-place content swap.
  const [dialogPhase, setDialogPhase] = useState<DialogPhase>('closed');
  // Set only when a new marker is clicked while the dialog is already open/animating; read once
  // the exit transition finishes (see the 'exiting' effect below).
  const pendingSourceIdRef = useRef<string | null>(null);

  const { data: allSources, error: initialLoadError } = useQuery<
    { sources: SourceResponse[] } | undefined
  >({
    initialData: undefined,
    queryKey: [],
    queryFn: async () => {
      const sources = await lightcurveApi.getSources();
      if (!sources) return;
      return { sources };
    },
  });

  const {
    data: lightcurveData,
    error: lightcurveLoadError,
    isLoading: isLightcurveLoading,
  } = useQuery<
    | {
        lightcurve: FrequencyLightcurveData | InstrumentLightcurveData;
        source: SourceResponse;
      }
    | undefined
  >({
    initialData: undefined,
    queryKey: [selectedSourceId, selectionStrategy],
    queryFn: async () => {
      if (selectedSourceId === null) return;
      const lightcurve = await lightcurveApi.getLightcurveData(
        selectedSourceId,
        selectionStrategy
      );
      const source = await lightcurveApi.getSourceData(selectedSourceId);
      if (!lightcurve || !source) return;
      return { lightcurve, source };
    },
  });

  if (initialLoadError) {
    throw initialLoadError;
  }

  if (lightcurveLoadError) {
    throw lightcurveLoadError;
  }

  // initialLoadData.sources is only ever replaced when a new fetch actually resolves (see
  // useQuery), so memoizing this transform keeps the array passed to AllSkyMap referentially
  // stable across re-renders
  const sources = allSources?.sources;
  const allSkyData: { skySources: SkySource[]; bands: Set<string> } =
    useMemo(() => {
      const bands = new Set<string>();
      const skySources =
        sources?.map((s) => {
          const source = {
            ra: s.ra,
            dec: s.dec,
            name: s.name,
            sourceId: s.source_id,
          } as SkySource;

          if (s.properties && s.properties.median_flux) {
            source['properties'] = s.properties;
            for (const band of Object.keys(s.properties['median_flux'])) {
              if (!bands.has(band)) bands.add(band);
            }
          }

          return source;
        }) ?? [];
      return { bands, skySources };
    }, [sources]);

  // Mirrors dialogPhase for handleClickedSource below, so that callback can have a permanently
  // stable identity (see its comment) while still reading the latest phase when invoked.
  const dialogPhaseRef = useRef(dialogPhase);
  dialogPhaseRef.current = dialogPhase;

  // If the dialog is closed, opens it directly and plays the enter transition. If it's already
  // open (or mid-transition), queues the new source and plays the exit transition instead - see
  // the 'exiting' phase effect below for what happens once that finishes.
  //
  // "Open"/"closed" are entirely represented by dialogPhase + CSS (the hidden class below) plus
  // the inert attribute; there's no underlying element to show()/close() natively; this used to
  // be a native <dialog>, but that turned out to cost ~80-100ms of synchronous browser work per
  // show()/close() call on this page, which silently ate a big chunk of the animation,
  // so it was replaced with a plain, always-mounted div.
  //
  // Also deliberately has no dependencies (reads dialogPhase via a ref instead) so its identity
  // never changes: it's passed to AllSkyMap as setClickedSourceId, which isn't memoized, so a
  // changing reference here would re-render the whole all-sky map on every dialog phase
  // transition.
  const handleClickedSource = useCallback((id: string) => {
    if (dialogPhaseRef.current === 'closed') {
      setSelectedSourceId(id);
      setDialogPhase(prefersReducedMotion() ? 'open' : 'entering');
      return;
    }

    pendingSourceIdRef.current = id;
    setDialogPhase('exiting');
  }, []);

  // Plays the exit transition and, once it finishes, actually closes the dialog. Used by the
  // Escape handler and the close button; clicking a new marker instead goes through
  // handleClickedSource above, which reuses this same 'exiting' phase for its close-then-reopen
  // cycle (see the 'exiting' effect below).
  const handleCloseDialog = useCallback(() => {
    if (dialogPhase === 'closed' || dialogPhase === 'exiting') return;
    pendingSourceIdRef.current = null;
    setDialogPhase('exiting');
  }, [dialogPhase]);

  // handleCloseDialog isn't stable across renders (it depends on dialogPhase), so the
  // once-attached keydown listener below reads it through a ref rather than depending on it
  // directly; same pattern as setClickedSourceIdRef in AllSkyMap.
  const handleCloseDialogRef = useRef(handleCloseDialog);
  handleCloseDialogRef.current = handleCloseDialog;

  // Kicks off the enter transition. useLayoutEffect runs synchronously as part of the commit,
  // before the browser paints, avoiding any scheduling delay that may eat into the transition;
  // reading el.offsetHeight forces the browser to compute layout with the "hidden" class still
  // applied, giving the CSS transition a real prior frame to animate from before immediately
  // flipping to the resting state.
  useLayoutEffect(() => {
    if (dialogPhase !== 'entering') return;
    if (prefersReducedMotion()) {
      setDialogPhase('open');
      return;
    }

    const el = dialogContentRef.current;
    if (el) void el.offsetHeight;
    setDialogPhase('open');
  }, [dialogPhase]);

  // Waits for the exit transition to finish, then either reopens for a queued source (a marker
  // was clicked while the dialog was already open) or actually closes the dialog. Also a
  // useLayoutEffect (see above) so attaching the transitionend listener/fallback timeout isn't
  // itself delayed.
  useLayoutEffect(() => {
    if (dialogPhase !== 'exiting') return;

    let done = false;
    const finishExit = () => {
      if (done) return;
      done = true;

      const nextId = pendingSourceIdRef.current;
      pendingSourceIdRef.current = null;
      if (nextId !== null) {
        setSelectedSourceId(nextId);
        setDialogPhase('entering');
      } else {
        setDialogPhase('closed');
      }
    };

    const el = dialogContentRef.current;
    if (!el || prefersReducedMotion()) {
      finishExit();
      return;
    }

    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.target === el) finishExit();
    };
    el.addEventListener('transitionend', handleTransitionEnd);
    // Fallback in case transitionend never fires for some reason; keeps the dialog from getting
    // stuck mid-exit.
    const timeout = window.setTimeout(finishExit, DIALOG_ANIM_DURATION_MS);

    return () => {
      el.removeEventListener('transitionend', handleTransitionEnd);
      window.clearTimeout(timeout);
    };
  }, [dialogPhase]);

  // Closes the dialog on Escape. Attached exactly once for the component's lifetime; reads
  // dialogPhaseRef/handleCloseDialogRef fresh on every invocation, so there's nothing here that
  // ever needs the effect to re-run.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialogPhaseRef.current !== 'closed') {
        handleCloseDialogRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <main>
      <div className="sources-plot-container all-sky">
        {allSkyData ? (
          <AllSkyMap
            sources={allSkyData.skySources}
            bands={allSkyData.bands}
            setClickedSourceId={handleClickedSource}
          />
        ) : (
          <div className="sources-plot-placeholder"></div>
        )}
      </div>
      <div
        className="home-lightcurve-dialog"
        role="dialog"
        aria-label="Source lightcurve preview"
        // Kept out of the tab order and hidden from assistive tech whenever it isn't fully open
        // (dialogPhase/CSS represent open vs. closed - see the hidden class below).
        inert={dialogPhase !== 'open'}
      >
        <div
          ref={dialogContentRef}
          className={
            'home-light-curve' +
            (dialogPhase === 'open' ? '' : ' home-light-curve--hidden')
          }
        >
          <button
            type="button"
            className="home-dialog-close-button"
            aria-label="Close"
            onClick={handleCloseDialog}
          >
            <CloseIcon width={16} height={16} />
          </button>
          {lightcurveData?.lightcurve && !isLightcurveLoading ? (
            <>
              <Lightcurve
                lightcurveData={lightcurveData.lightcurve}
                plotLayout={DEFAULT_HOMEPAGE_PLOT_LAYOUT}
                selectionStrategy={selectionStrategy}
                setSelectionStrategy={setSelectionStrategy}
                hideStrategyToggle={true}
                hideFlaggedObsToggle={true}
                title={lightcurveData.source.name}
                subtitle="View the source page to learn more"
              />
              <div className="home-source-link-container">
                <button
                  type="button"
                  className="home-source-link"
                  onClick={() => {
                    // Navigating away regardless, so skip the exit transition and reset
                    // immediately rather than leaving a pending source queued for whenever the
                    // user comes back to this page.
                    pendingSourceIdRef.current = null;
                    setDialogPhase('closed');
                    void navigate(
                      '/source/' + lightcurveData.lightcurve.source_id
                    );
                  }}
                >
                  <span>
                    View source page <LinkOutIcon width={16} height={16} />
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div
              className="lightcurve-loading"
              style={{
                height: DEFAULT_HOMEPAGE_PLOT_LAYOUT.height,
                width: '100%',
              }}
            >
              Loading...
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
