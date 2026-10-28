import { useEffect, useState } from 'react';
import { hasSessionCookies, LOGIN_URL, LOGOUT_URL } from '../utils/auth';

export function Login() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    setIsAuthenticated(hasSessionCookies());
  }, []);

  if (isAuthenticated === null) return null;

  const linkText = isAuthenticated ? 'Log Out' : 'Log In';
  const href = isAuthenticated ? LOGOUT_URL : LOGIN_URL;

  return (
    <a className="login-link-btn" href={href}>
      {linkText}
      <img className="login-icon" src="/so-auth-icon.png" />
    </a>
  );
}
