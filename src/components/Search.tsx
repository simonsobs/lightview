import { FormEvent, useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import './styles/search-form.css';
import { SearchIcon } from './icons/SearchIcon';

export function Search() {
  const navigation = useNavigate();
  const [value, setValue] = useState<string>('id-search');

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const formElement = e.target as HTMLFormElement;
      const formData = new FormData(formElement);

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
    [navigation, value]
  );

  return (
    <div className="search-container">
      <select
        onChange={(e) => setValue(e.target.value)}
        id="search-type"
        value={value}
      >
        <option value="id-search">Search by ID</option>
        <option value="cone-search">Cone search (ra, dec, radius)</option>
        <option disabled value="catalog-search">
          Search by catalog via SIMBAD
        </option>
        <option disabled value="flare-date-search">
          Search by flare strength and date range
        </option>
      </select>
      <form id="search-form" className="search-form" onSubmit={handleSubmit}>
        {value === 'cone-search' && (
          <>
            <label htmlFor="ra">
              ra
              <input
                className="cone-search-input"
                id="ra"
                name="ra"
                type="text"
                required
              />
            </label>
            <label htmlFor="dec">
              dec
              <input
                className="cone-search-input"
                id="dec"
                name="dec"
                type="text"
                required
              />
            </label>
            <label htmlFor="radius">
              radius
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
      </form>
      <button className="submit-search-btn" form="search-form" type="submit">
        {<SearchIcon />}
      </button>
    </div>
  );
}
