import { Route, Routes, useLocation } from 'react-router';
import { Navigation } from './components/Navigation';
import { Main } from './components/Main';
import { PageNotFound } from './components/PageNotFound';
import { Source } from './components/Source';
import { SearchResults } from './components/SearchResults';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorBoundaryWrapper } from './components/ErrorBoundaryWrapper';
import { Footer } from './Footer';

function App() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <>
      <Navigation />
      {/*
        Main (and the AllSkyMap it renders) stays mounted for the whole session instead of
        unmounting on every route change: rebuilding AllSkyMap's Aladin/WebGL catalog from
        scratch on every home-page revisit gets more expensive as the source count grows, and
        there's no official Aladin Lite API to tear down and recreate that catalog cheaply.
        It's kept outside ErrorBoundaryWrapper on purpose - that wrapper force-remounts its
        children on every navigation (see its key-increment effect), which would defeat this.
      */}
      <div style={{ display: isHome ? undefined : 'none' }}>
        <ErrorBoundary>
          <Main />
        </ErrorBoundary>
      </div>
      <ErrorBoundaryWrapper>
        <Routes>
          <Route index element={null} />
          <Route path="/search/*" element={<SearchResults />} />
          <Route path="/source/:id" element={<Source />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </ErrorBoundaryWrapper>
      <Footer />
    </>
  );
}

export default App;
