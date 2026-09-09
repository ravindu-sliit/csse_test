import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { apiClient } from '@/api/client';
import './index.css';

// Rehydrate Authorization header from persisted auth state on page load
// Zustand persist restores the token to the store, but Axios headers need
// to be set manually since they are not part of the persisted state.
try {
  const stored = localStorage.getItem('dmc-auth');
  if (stored) {
    const parsed = JSON.parse(stored) as { state?: { accessToken?: string } };
    const token = parsed?.state?.accessToken;
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }
} catch {
  // localStorage unavailable or malformed — proceed without token
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
