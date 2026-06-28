import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createCheckout, createPortal, fetchBillingStatus } from '../api/client';

export function SupportPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ status: string; plan: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subscribe = async (plan: 'monthly' | 'yearly') => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await createCheckout(plan, email || undefined);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const manage = async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const { url } = await createPortal(email);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Portal failed');
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!email) return;
    const s = await fetchBillingStatus(email);
    setStatus(s);
  };

  return (
    <div className="support-page">
      <Link to="/" style={{ color: '#007AFF' }}>
        ← Back to map
      </Link>
      <h1 style={{ fontWeight: 700, letterSpacing: '-0.5px' }}>Support paxor</h1>
      <p className="disclaimer">
        All charging features are free. This subscription supports development and reserves future
        perks — nothing is locked today.
      </p>

      <input
        type="email"
        placeholder="Email (optional, for receipts)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: '100%',
          padding: 14,
          borderRadius: 12,
          border: '1px solid #eee',
          marginBottom: 16,
        }}
      />

      <div className="plan-card">
        <h3>Monthly — $20/mo</h3>
        <p style={{ color: '#8E8E93' }}>Support ongoing development</p>
        <button className="primary-pill" disabled={loading} onClick={() => subscribe('monthly')}>
          Subscribe
        </button>
      </div>

      <div className="plan-card">
        <h3>Yearly — $200/yr</h3>
        <p style={{ color: '#8E8E93' }}>Best value for supporters</p>
        <button className="primary-pill" disabled={loading} onClick={() => subscribe('yearly')}>
          Subscribe
        </button>
      </div>

      {error && <p className="billing-error">{error}</p>}

      {email && (
        <div style={{ marginTop: 24 }}>
          <button className="pill-btn" onClick={checkStatus} style={{ marginRight: 8 }}>
            Check status
          </button>
          <button className="pill-btn" onClick={manage}>
            Manage subscription
          </button>
          {status && (
            <p style={{ marginTop: 12 }}>
              Status: <strong>{status.status}</strong> ({status.plan})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
