import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { setupAxiosInterceptors } from './services/axiosInstance';
import { AppRouter } from './router/AppRouter';

function AxiosSetup() {
  const { accessToken, setAccessToken, logout } = useAuth();

  useEffect(() => {
    setupAxiosInterceptors(
      () => accessToken,
      () => logout()
    );

    function handleRefresh(e: Event) {
      setAccessToken((e as CustomEvent<string>).detail);
    }
    window.addEventListener('token:refreshed', handleRefresh);
    return () => window.removeEventListener('token:refreshed', handleRefresh);
  }, [accessToken, setAccessToken, logout]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <AxiosSetup />
      <AppRouter />
    </AuthProvider>
  );
}