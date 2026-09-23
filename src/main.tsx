import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
