import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import './styles/search-form.css';
import { SearchIcon } from './icons/SearchIcon';
import { useSkyTarget } from '../contexts/SkyTargetContext';
import { resolveSimbadObject, SimbadResolveError } from '../utils/simbad';
import { CloseIcon } from './icons/CloseIcon';

type CatalogSearchError = { message: string; detail?: string };

export function Search() {
  const navigation = useNavigate();
  const { pathname } = useLocation();
  const { goToSkyTarget } = useSkyTarget();
  const [value, setValue] = useState<string>('cone-search');
  const [isResolving, setIsResolving] = useState(false);
  // Successful catalog searches are reported on the map itself (see AllSkyMap's pinned target
  // popup); failures have no position to show there, so they're shown under the search bar.
  const [catalogError, setCatalogError] = useState<CatalogSearchError | null>(
    null
  );
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
      setCatalogError(null);

      try {
        const object = await resolveSimbadObject(query, controller.signal);
        if (controller.signal.aborted) return;
        goToSkyTarget({
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
        setCatalogError(
          e instanceof SimbadResolveError
            ? { message: e.message, detail: e.detail }
            : {
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
        const queryParams = new URLSearchParams({
          ra: formData.get('ra') as string,
          dec: formData.get('dec') as string,
          radius: formData.get('radius') as string,
        });

        const redirectUrl = new URL(
          window.location.origin + '/search/cone?' + queryParams.toString()
        );

        void navigation(redirectUrl.pathname + redirectUrl.search);
      } else {
        const sourceID = formData.get('source-id') as string;

        const redirectUrl = new URL(
          window.location.origin + '/source/' + sourceID
        );

        void navigation(redirectUrl.pathname);
      }

      formElement.reset();
    },
    [navigation, value, runCatalogSearch]
  );

  // Escape dismisses the error, like the app's other popups; only listening while it's shown.
  useEffect(() => {
    if (!catalogError) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCatalogError(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [catalogError]);

  return (
    <div className="search-container">
      <select
        onChange={(e) => {
          setValue(e.target.value);
          setCatalogError(null);
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
      {catalogError && (
        <div className="search-error-popover" role="alert">
          <div className="search-error-popover-header">
            <strong>Catalog search failed</strong>
            <button
              type="button"
              className="search-error-popover-close"
              aria-label="Dismiss error"
              onClick={() => setCatalogError(null)}
            >
              <CloseIcon width={12} height={12} />
            </button>
          </div>
          <p>{catalogError.message}</p>
          {catalogError.detail && (
            <p className="search-error-popover-detail">
              SIMBAD: {catalogError.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
