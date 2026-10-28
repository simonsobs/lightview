export const LOGIN_URL = import.meta.env.VITE_LOGIN_SERVICE as string;
export const LOGOUT_URL = import.meta.env.VITE_LOGOUT_SERVICE as string;

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

/** Whether the auth service's JS-readable session flags are set. They only say a login happened,
 * not that the session is still valid server-side, so a request can still be rejected while this
 * returns true (e.g. an expired session). */
export function hasSessionCookies(): boolean {
  return (
    !!getCookie('valid_access_token') && !!getCookie('valid_refresh_token')
  );
}
