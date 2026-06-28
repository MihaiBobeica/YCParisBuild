import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MapPage } from './pages/MapPage';
import { LoginGate } from './components/auth/LoginGate';
import { useUserProfile } from './hooks/useUserProfile';

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
              <MapPage profile={profile} setProfile={setProfile} signOut={signOut} />
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
