import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

interface GoogleClaims {
  email?: string;
  name?: string;
  picture?: string;
}

interface Props {
  clientId: string | undefined;
  onLogin: (identity: { email: string; name: string }) => void;
}

export function LoginGate({ clientId, onLogin }: Props) {
  return (
    <div className="login-gate">
      <div className="login-gate-card">
        <span className="login-gate-wordmark">paxor</span>
        <h1 className="login-gate-title">Charge smarter</h1>
        <p className="login-gate-sub">
          Sign in to find chargers, book discounted partner slots, and track your savings.
        </p>

        {clientId ? (
          <div className="login-gate-button">
            <GoogleLogin
              onSuccess={(cred) => {
                if (!cred.credential) return;
                const claims = jwtDecode<GoogleClaims>(cred.credential);
                if (!claims.email) return;
                onLogin({ email: claims.email, name: claims.name || '' });
              }}
              onError={() => {
                /* surfaced by the Google button itself */
              }}
              theme="filled_black"
              shape="pill"
              size="large"
              text="continue_with"
            />
          </div>
        ) : (
          <p className="login-gate-config">
            Google sign-in isn’t configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in your
            environment to enable it.
          </p>
        )}
      </div>
    </div>
  );
}
