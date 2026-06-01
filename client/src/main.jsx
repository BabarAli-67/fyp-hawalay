import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { PwaInstallProvider } from './context/PwaInstallContext.jsx';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { registerOfflineSyncListeners } from './utils/offlineSync.js';

registerOfflineSyncListeners();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PwaInstallProvider>
          <App />
        </PwaInstallProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
