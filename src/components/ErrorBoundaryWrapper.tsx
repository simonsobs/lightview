import { useLocation } from 'react-router';
import { useEffect, useState, ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

export function ErrorBoundaryWrapper({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [key, setKey] = useState(0);

  useEffect(() => {
    // force a re-mount on location change, thereby resetting the error boundary's hasError state
    setKey((prevKey) => prevKey + 1);
  }, [location]);

  return <ErrorBoundary key={key}>{children}</ErrorBoundary>;
}
