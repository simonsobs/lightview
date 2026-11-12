import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { BrowserRouter } from 'react-router';
import { loadAladinScript } from './utils/initAladin';

// Queue Aladin's download now rather than waiting for the first sky map to mount. It starts once
// the page has loaded (see loadAladinScript), so the large chunk doesn't hold up the app's own
// first load.
loadAladinScript().catch(() => {
  // Each viewer retries and reports its own failure via initAladin
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
