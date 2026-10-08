import { useState, useEffect } from 'react';

interface GeolocationState {
  location: { lat: number; lng: number } | null;
  error: string | null;
  isLoading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    error: null,
    isLoading: false,
  });

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocation is not supported by your browser' }));
      return;
    }
    setState(s => ({ ...s, isLoading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          location: { lat: position.coords.latitude, lng: position.coords.longitude },
          error: null,
          isLoading: false,
        });
      },
      (err) => {
        setState({ location: null, error: `GPS unavailable: ${err.message}`, isLoading: false });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Auto-request on mount
  useEffect(() => { requestLocation(); }, []);

  return { ...state, requestLocation };
}