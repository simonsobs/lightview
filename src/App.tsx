import { Route, Routes } from 'react-router';
import { Navigation } from './components/Navigation';
import { Main } from './components/Main';
import { PageNotFound } from './components/PageNotFound';
import { Source } from './components/Source';
import { SearchResults } from './components/SearchResults';

function App() {
  return (
    <>
      <Navigation />
      <Routes>
        <Route index element={<Main />} />
        <Route path="/search/*" element={<SearchResults />} />
        <Route path="/source/:id" element={<Source />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
}

export default App;
