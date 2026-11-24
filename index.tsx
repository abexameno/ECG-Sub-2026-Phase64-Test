import React, { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';

console.log("🏫 Initializing Exameno ECG Application...");

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
  errorInfo: any;
}

// FIX: To resolve errors about missing `setState` and `props`, GlobalErrorBoundary must be a React class component. It has been updated to extend `React.Component`.
class GlobalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // FIX: Converted state initialization to use a constructor to resolve potential environment-specific issues with class field declarations and ensure 'setState' and 'props' are correctly bound.
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: any): Partial<ErrorBoundaryState> {
    return { hasError: true, error: error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("CRITICAL: Component Tree Error Caught", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch (e) {
      window.location.href = window.location.origin;
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '1rem', border: '1px solid #e2e8f0', maxWidth: '800px', width: '100%', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h1 style={{ color: '#059669', fontSize: '1.8rem', marginBottom: '1rem' }}>Application Encountered an Error</h1>
            <p style={{ color: '#334155', marginBottom: '1.5rem' }}>This usually happens if saved data becomes incompatible. Resetting the app usually fixes it.</p>
            
            <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <pre style={{
                backgroundColor: '#f1f5f9',
                padding: '1rem',
                borderRadius: '0.5rem',
                overflow: 'auto',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                border: '1px solid #e2e8f0',
                color: '#475569',
                maxHeight: '300px'
              }}>
                {this.state.error?.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Reload App
              </button>
              <button 
                onClick={this.handleReset}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Reset Data & Clear Cache
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    return this.props.children || null;
  }
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <GlobalErrorBoundary>
      <MemoryRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </MemoryRouter>
    </GlobalErrorBoundary>
  );

  // Register service worker
  if ('serviceWorker' in navigator) {
    const isDev = import.meta.env.DEV || 
                  window.location.hostname.includes('ais-dev') || 
                  window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1';

    if (isDev) {
      // Unregister any active service workers in development mode to prevent aggressive caching
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          registration.unregister().then(success => {
            if (success) {
              console.log('Successfully unregistered service worker in development mode.');
            }
          });
        }
      });

      // Clear caches to ensure fresh development assets are always fetched from the server
      if ('caches' in window) {
        caches.keys().then(names => {
          for (const name of names) {
            caches.delete(name);
          }
          console.log('Cleared all CacheStorage in development mode.');
        });
      }
    } else {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(registration => {
            console.log('SW registered: ', registration);

            // Force update check on load
            registration.update().catch(err => console.log('SW update on load failed:', err));

            // Check for service worker updates periodically (every 5 minutes)
            setInterval(() => {
              registration.update().catch(err => console.log('SW periodic update failed:', err));
            }, 1000 * 60 * 5);
          })
          .catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
          });
      });

      // Automatically reload when a new service worker takes over control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('Service Worker controller changed. Reloading page...');
          window.location.reload();
        }
      });
    }
  }
} else {
    console.error("Root element not found");
}