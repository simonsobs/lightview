import { Component, ReactNode } from 'react';
import { ApiError } from '../api/client';
import { CONTACT_EMAIL, IS_AUTH_ENABLED } from '../configs/constants';
import { hasSessionCookies, LOGIN_URL } from '../utils/auth';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

type ErrorKind = 'login-required' | 'session-expired' | 'forbidden' | 'other';

/** The server answers 403 (not 401) when there's no session at all, so the status alone can't
 * tell "not logged in" from "logged in without access"; the session cookies break the tie. */
function classifyError(error: Error | undefined): ErrorKind {
  if (
    !IS_AUTH_ENABLED ||
    !(error instanceof ApiError) ||
    (error.status !== 401 && error.status !== 403)
  ) {
    return 'other';
  }
  if (!hasSessionCookies()) return 'login-required';
  return error.status === 401 ? 'session-expired' : 'forbidden';
}

const loginButton = (
  <a className="login-link-btn error-boundary-action" href={LOGIN_URL}>
    Log In
    <img className="login-icon" src="/so-auth-icon.png" alt="" />
  </a>
);

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('Error caught by ErrorBoundary:', error);
  }

  /** Clearing the error remounts the children, which refetch (failed requests aren't cached, see
   * LightcurveApiClient.cached). */
  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  private renderError() {
    const { error } = this.state;

    switch (classifyError(error)) {
      case 'login-required':
        return (
          <>
            <h2 className="error-boundary-title">Please log in</h2>
            <p>You need to log in to view this data.</p>
            {loginButton}
          </>
        );
      case 'session-expired':
        return (
          <>
            <h2 className="error-boundary-title">Your session has expired</h2>
            <p>Please log in again to continue.</p>
            {loginButton}
          </>
        );
      case 'forbidden':
        return (
          <>
            <h2 className="error-boundary-title">Access denied</h2>
            <p>
              Your account doesn't have access to this data. If you think it
              should,{' '}
              <a className="text-so-blue" href={`mailto:${CONTACT_EMAIL}`}>
                contact us
              </a>
              .
            </p>
          </>
        );
      case 'other':
        return (
          <>
            <h2 className="error-boundary-title">
              Oops! Something went wrong.
            </h2>
            <p>{error?.message || 'An unexpected error occurred.'}</p>
            <button
              type="button"
              className="login-link-btn error-boundary-action"
              onClick={this.handleRetry}
            >
              Try again
            </button>
          </>
        );
    }
  }

  render() {
    if (this.state.hasError) {
      return <main>{this.renderError()}</main>;
    }

    return this.props.children;
  }
}
