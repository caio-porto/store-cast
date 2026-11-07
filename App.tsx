import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { Screen } from './components/Screen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CONFIG } from './config';

function App() {
  const [mode, setMode] = useState<'SCREEN' | 'DASHBOARD' | 'LOADING'>('LOADING');

  useEffect(() => {
    // Detect mode based on Port, Environment, Domain, or URL Parameter
    const port = window.location.port;
    const hostname = window.location.hostname;
    const query = new URLSearchParams(window.location.search);
    const urlMode = query.get('mode');

    // Robust check for Capacitor (Android/iOS Native App)
    // Modern Capacitor uses https:// scheme, so protocol check alone is insufficient.
    const isCapacitor = (window as any).Capacitor !== undefined;

    // 1. Force via Config (CONFIG.FORCE_SCREEN_MODE)
    // 2. Force via URL (?mode=SCREEN)
    // 3. Capacitor (Android App) -> Screen
    // 4. TV Domain (from CONFIG) -> Screen
    // 5. Screen Port (from CONFIG) -> Screen
    // 6. Contains 'screen' or 'previewCampaign' query params -> Screen
    if (CONFIG.FORCE_SCREEN_MODE || urlMode === 'SCREEN' || isCapacitor || hostname === CONFIG.PRODUCTION.DOMAIN_SCREEN || port === String(CONFIG.LOCAL.DEFAULT_SCREEN_PORT) || query.has('screen') || query.has('previewCampaign')) {
      setMode('SCREEN');
    } else {
      // Default to dashboard for 8766, main domain, or dev
      setMode('DASHBOARD');
    }
  }, []);

  // Debug: Log the detected mode
  useEffect(() => {
    console.log('App Mode initialized:', mode);
  }, [mode]);

  if (mode === 'LOADING') {
    return (
      <div style={{ height: '100vh', width: '100vw', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Initializing Store Cast...</h1>
        <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#94a3b8', backgroundColor: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '0.25rem', maxWidth: '100%', overflow: 'auto' }}>
          <p>Hostname: {window.location.hostname}</p>
          <p>Port: {window.location.port}</p>
          <p>Protocol: {window.location.protocol}</p>
          <p>Capacitor: {(window as any).Capacitor ? 'Detected' : 'Not Detected'}</p>
          <p>User Agent: {navigator.userAgent}</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary name="App">
      {mode === 'SCREEN' ? <Screen onExit={() => { }} /> : <Dashboard onExit={() => { }} />}
    </ErrorBoundary>
  );
}

export default App;