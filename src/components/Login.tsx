import { useEffect, useState } from 'react';
import './styles/login.css';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

export function Login() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    const hasAccessToken = getCookie('valid_access_token');
    const hasRefreshToken = getCookie('valid_refresh_token');

    setIsAuthenticated(!!hasAccessToken && !!hasRefreshToken);
  }, []);

  if (isAuthenticated === null) return null;

  const linkText = isAuthenticated ? 'Log Out' : 'Log In';
  const href = isAuthenticated
    ? (import.meta.env.VITE_LOGOUT_SERVICE as string)
    : (import.meta.env.VITE_LOGIN_SERVICE as string);

  return (
    <a className="login-link-btn" href={href}>
      {linkText}
      <img className="login-icon" src="/so-auth-icon.png" />
    </a>
  );
}
