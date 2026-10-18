import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installGlobalErrorReporting } from './lib/errorReporting';
import './index.css';
// Capture the browser's install prompt as early as possible (Phase 10)
import './lib/installPrompt';
// Always run the latest version: look for updates and reload once when one is out
import './lib/appUpdate';

installGlobalErrorReporting();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
