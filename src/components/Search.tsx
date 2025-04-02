import { FormEvent, useCallback } from 'react';
import { useNavigate } from 'react-router';

export function Search() {
  const navigation = useNavigate();

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const formElement = e.target as HTMLFormElement;
      const formData = new FormData(formElement);
      const queryParams = new URLSearchParams({
        ra: formData.get('ra') as string,
        dec: formData.get('dec') as string,
        radius: formData.get('radius') as string,
      });

      const redirectUrl = new URL(
        window.location.origin + '/search/cone?' + queryParams.toString()
      );

      void navigation(redirectUrl.pathname + redirectUrl.search);
    },
    [navigation]
  );

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="ra">
        ra
        <input name="ra" type="text" required />
      </label>
      <label htmlFor="dec">
        dec
        <input name="dec" type="text" required />
      </label>
      <label htmlFor="radius">
        radius
        <input name="radius" type="text" required />
      </label>
      <button type="submit">Search</button>
    </form>
  );
}
