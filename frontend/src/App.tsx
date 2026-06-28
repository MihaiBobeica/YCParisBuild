import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginGate } from './components/auth/LoginGate';
import { useUserProfile } from './hooks/useUserProfile';

// Keep the map + Leaflet bundle out of the critical path: unauthenticated users
// (LoginGate) never download it, and it loads only once the user is signed in.
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function App() {
  const { profile, setProfile, signOut } = useUserProfile();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            profile.authed ? (
              <Suspense fallback={null}>
                <MapPage profile={profile} setProfile={setProfile} signOut={signOut} />
              </Suspense>
            ) : (
              <LoginGate
                clientId={GOOGLE_CLIENT_ID}
                onLogin={({ email, name }) => setProfile({ email, name, authed: true })}
              />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
