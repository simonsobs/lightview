import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import './styles/search-form.css';
import { SearchIcon } from './icons/SearchIcon';
import { useSkyTarget } from '../contexts/SkyTargetContext';
import { resolveSimbadObject, SimbadResolveError } from '../utils/simbad';
import { parseConeSearch } from '../utils/coneSearch';
import { CloseIcon } from './icons/CloseIcon';

type SearchError = { title: string; message: string; detail?: string };

export function Search() {
  const navigation = useNavigate();
  const { pathname } = useLocation();
  const { goToSkyTarget } = useSkyTarget();
  const [value, setValue] = useState<string>('cone-search');
  const [isResolving, setIsResolving] = useState(false);
  // Successful catalog and cone searches are reported on the map itself (see AllSkyMap's pinned
  // target popup); failures have no position to show there, so they're shown under the search bar.
  const [searchError, setSearchError] = useState<SearchError | null>(null);
  // Lets a new catalog search (or unmounting) cancel one still in flight, so a slow earlier
  // response can never land after, and overwrite, a newer one.
  const resolveControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => resolveControllerRef.current?.abort(), []);

  const runCatalogSearch = useCallback(
    async (query: string, formElement: HTMLFormElement) => {
      resolveControllerRef.current?.abort();
      const controller = new AbortController();
      resolveControllerRef.current = controller;
      setIsResolving(true);
      setSearchError(null);

      try {
        const object = await resolveSimbadObject(query, controller.signal);
        if (controller.signal.aborted) return;
        goToSkyTarget({
          kind: 'object',
          name: object.identifier,
          ra: object.ra,
          dec: object.dec,
        });
        // The all-sky map only lives on the home page
        if (pathname !== '/') void navigation('/');
        formElement.reset();
      } catch (e) {
        if (controller.signal.aborted) return;
        // Left in the input on failure so a typo can be fixed rather than retyped
        setSearchError(
          e instanceof SimbadResolveError
            ? {
                title: 'Catalog search failed',
                message: e.message,
                detail: e.detail,
              }
            : {
                title: 'Catalog search failed',
                message:
                  'Something went wrong while searching SIMBAD. Please try again.',
              }
        );
      } finally {
        if (resolveControllerRef.current === controller) {
          resolveControllerRef.current = null;
          setIsResolving(false);
        }
      }
    },
    [goToSkyTarget, navigation, pathname]
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const formElement = e.target as HTMLFormElement;
      const formData = new FormData(formElement);

      if (value === 'catalog-search') {
        const query = ((formData.get('catalog-name') as string) ?? '').trim();
        if (query) void runCatalogSearch(query, formElement);
        return;
      }

      if (value === 'cone-search') {
        const result = parseConeSearch(
          (formData.get('ra') as string) ?? '',
          (formData.get('dec') as string) ?? '',
          (formData.get('radius') as string) ?? ''
        );
        if (!result.ok) {
          // Left in the inputs so the bad value can be corrected
          setSearchError({
            title: 'Invalid cone search',
            message: result.message,
          });
          return;
        }
        // Otherwise a catalog search still in flight could land afterwards and move the map away
        resolveControllerRef.current?.abort();
        setSearchError(null);
        goToSkyTarget({ kind: 'cone', ...result.cone });
        // The all-sky map only lives on the home page
        if (pathname !== '/') void navigation('/');
      } else {
        const sourceID = formData.get('source-id') as string;

        const redirectUrl = new URL(
          window.location.origin + '/source/' + sourceID
        );

        void navigation(redirectUrl.pathname);
      }

      formElement.reset();
    },
    [navigation, value, runCatalogSearch, goToSkyTarget, pathname]
  );

  // Escape dismisses the error, like the app's other popups; only listening while it's shown.
  useEffect(() => {
    if (!searchError) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchError(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchError]);

  return (
    <div className="search-container">
      <select
        onChange={(e) => {
          setValue(e.target.value);
          setSearchError(null);
        }}
        id="search-type"
        value={value}
        className="source-search"
      >
        <option value="cone-search">Cone search (ra, dec, radius)</option>
        <option value="id-search">Search by ID</option>
        <option value="catalog-search">Search by catalog via SIMBAD</option>
        <option disabled value="flare-date-search">
          Search by flare strength and date range
        </option>
      </select>
      <form id="search-form" className="search-form" onSubmit={handleSubmit}>
        {value === 'cone-search' && (
          <>
            <label htmlFor="ra">
              <span>
                ra <span>(degrees)</span>
              </span>
              <input
                className="cone-search-input"
                id="ra"
                name="ra"
                type="text"
                required
              />
            </label>
            <label htmlFor="dec">
              <span>
                dec <span>(degrees)</span>
              </span>
              <input
                className="cone-search-input"
                id="dec"
                name="dec"
                type="text"
                required
              />
            </label>
            <label htmlFor="radius">
              <span>
                radius <span>(degrees)</span>
              </span>
              <input
                className="cone-search-input"
                id="radius"
                name="radius"
                type="text"
                required
              />
            </label>
          </>
        )}
        {value === 'id-search' && (
          <label htmlFor="source-id">
            Source ID
            <input id="source-id" name="source-id" type="text" required />
          </label>
        )}
        {value === 'catalog-search' && (
          <label htmlFor="catalog-name">
            Object name
            <input
              id="catalog-name"
              name="catalog-name"
              type="text"
              placeholder="e.g. M 31, 3C 273"
              required
              disabled={isResolving}
            />
          </label>
        )}
      </form>
      <button
        className="submit-search-btn"
        form="search-form"
        type="submit"
        disabled={isResolving}
        aria-busy={isResolving}
        title={isResolving ? 'Searching SIMBAD…' : 'Search'}
      >
        {isResolving ? (
          <span className="search-spinner" aria-hidden="true" />
        ) : (
          <SearchIcon className="submit-search-icon" />
        )}
      </button>
      {searchError && (
        <div className="search-error-popover" role="alert">
          <div className="search-error-popover-header">
            <strong>{searchError.title}</strong>
            <button
              type="button"
              className="search-error-popover-close"
              aria-label="Dismiss error"
              onClick={() => setSearchError(null)}
            >
              <CloseIcon width={12} height={12} />
            </button>
          </div>
          <p>{searchError.message}</p>
          {searchError.detail && (
            <p className="search-error-popover-detail">
              SIMBAD: {searchError.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
