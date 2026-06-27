import { useState } from 'react';
import { createCheckout, createPortal, fetchBillingStatus } from '../../api/client';
import { CONNECTOR_OPTIONS, type UserProfile } from '../../hooks/useUserProfile';

interface Props {
  profile: UserProfile;
  onChange: (patch: Partial<UserProfile>) => void;
  onClose: () => void;
}

export function AccountSheet({ profile, onChange, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ status: string; plan: string } | null>(null);

  const subscribe = async (plan: 'monthly' | 'yearly') => {
    setLoading(true);
    try {
      const { url } = await createCheckout(plan, profile.email || undefined);
      window.location.href = url;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const manage = async () => {
    if (!profile.email) return;
    setLoading(true);
    try {
      const { url } = await createPortal(profile.email);
      window.location.href = url;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Portal failed');
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!profile.email) return;
    const s = await fetchBillingStatus(profile.email);
    setStatus(s);
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="account-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="search-sheet-header">
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <h2>Your account</h2>
        </div>

        <section className="account-section">
          <label className="field-label">Email</label>
          <input
            className="field-input"
            type="email"
            placeholder="you@example.com"
            value={profile.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </section>

        <section className="account-section">
          <label className="field-label">Car name (optional)</label>
          <input
            className="field-input"
            placeholder="My EV"
            value={profile.carName}
            onChange={(e) => onChange({ carName: e.target.value })}
          />
        </section>

        <section className="account-section">
          <label className="field-label">Your connector</label>
          <p className="field-hint">We’ll prioritize chargers that fit your car.</p>
          <div className="connector-grid">
            {CONNECTOR_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`connector-card${profile.connectorType === opt.id ? ' selected' : ''}`}
                onClick={() => onChange({ connectorType: profile.connectorType === opt.id ? '' : opt.id })}
              >
                <strong>{opt.label}</strong>
                <span>{opt.sub}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="account-billing">
          <h3>Support the app</h3>
          <p className="field-hint">All features stay free. Subscribe to support development.</p>

          <div className="billing-plans">
            <div className="billing-plan">
              <div>
                <strong>Monthly</strong>
                <span>$20 / mo</span>
              </div>
              <button type="button" className="billing-btn" disabled={loading} onClick={() => subscribe('monthly')}>
                Subscribe
              </button>
            </div>
            <div className="billing-plan">
              <div>
                <strong>Yearly</strong>
                <span>$200 / yr</span>
              </div>
              <button type="button" className="billing-btn" disabled={loading} onClick={() => subscribe('yearly')}>
                Subscribe
              </button>
            </div>
          </div>

          {profile.email && (
            <div className="billing-actions">
              <button type="button" className="dock-pill" onClick={checkStatus}>
                Check status
              </button>
              <button type="button" className="dock-pill" onClick={manage}>
                Manage
              </button>
            </div>
          )}
          {status && (
            <p className="billing-status">
              Status: <strong>{status.status}</strong> ({status.plan})
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
