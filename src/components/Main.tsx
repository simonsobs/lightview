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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lightcurveApi } from '../api/client';
import AllSkyMap, { SkySource } from './AllSkyMap';
import { LinkOutIcon } from './icons/LinkOutIcon';
import { CloseIcon } from './icons/CloseIcon';

/** Renders the "home" page of the web app */
export function Main() {
  const [selectionStrategy, setSelectionStrategy] =
    useState<SelectionStrategy>('instrument');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

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

  // Opens the dialog synchronously and unconditionally, so re-clicking the same already-selected
  // marker after closing the dialog reopens it too (selectedSourceId alone wouldn't change in
  // that case, so an effect keyed on it - or on the fetched lightcurveData - would never re-fire).
  const handleClickedSource = useCallback((id: string) => {
    setSelectedSourceId(id);
    dialogRef.current?.show();
  }, []);

  // Closes the dialog on Escape. Attached exactly once for the component's lifetime - dialogRef
  // is a stable ref object (its `.current` is read fresh on every invocation), so there's
  // nothing here that ever needs the effect to re-run.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialogRef.current?.open) {
        dialogRef.current.close();
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
      <dialog ref={dialogRef} className="home-lightcurve-dialog">
        <div className="home-light-curve">
          <button
            type="button"
            className="home-dialog-close-button"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
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
                    dialogRef.current?.close();
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
      </dialog>
    </main>
  );
}
