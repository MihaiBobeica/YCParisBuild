import { useEffect, useState } from 'react';
import {
  createCheckout,
  createPortal,
  deletePartnerBooking,
  fetchBillingStatus,
  fetchPartnerBookings,
  fetchPartnerSavings,
  type PartnerBooking,
  type SavingsSummary,
} from '../../api/client';
import { MenuSheet } from '../layout/MenuSheet';
import { CONNECTOR_OPTIONS, type UserProfile } from '../../hooks/useUserProfile';

interface Props {
  profile: UserProfile;
  onChange: (patch: Partial<UserProfile>) => void;
  onClose: () => void;
  savingsRefresh?: number;
}

const TZ = 'Europe/Amsterdam';

function fmtSlot(b: PartnerBooking): string {
  const start = new Date(b.slot_start);
  const day = start.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  });
  const t1 = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
  const t2 = new Date(b.slot_end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
  return `${day} · ${t1}–${t2}`;
}

export function AccountSheet({ profile, onChange, onClose, savingsRefresh = 0 }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ status: string; plan: string } | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [savings, setSavings] = useState<SavingsSummary | null>(null);
  const [bookings, setBookings] = useState<PartnerBooking[]>([]);

  useEffect(() => {
    if (!profile.email) {
      setSavings(null);
      setBookings([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [s, b] = await Promise.all([
          fetchPartnerSavings(profile.email),
          fetchPartnerBookings(profile.email),
        ]);
        if (!cancelled) {
          setSavings(s);
          setBookings(b);
        }
      } catch {
        if (!cancelled) {
          setSavings(null);
          setBookings([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.email, savingsRefresh]);

  const cancelBooking = async (id: string) => {
    if (!profile.email) return;
    try {
      await deletePartnerBooking(id, profile.email);
      const [s, b] = await Promise.all([
        fetchPartnerSavings(profile.email),
        fetchPartnerBookings(profile.email),
      ]);
      setSavings(s);
      setBookings(b);
    } catch {
      /* ignore */
    }
  };

  const subscribe = async (plan: 'monthly' | 'yearly') => {
    setLoading(true);
    setBillingError(null);
    try {
      const { url } = await createCheckout(plan, profile.email || undefined);
      window.location.href = url;
    } catch (e) {
      setBillingError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const manage = async () => {
    if (!profile.email) return;
    setLoading(true);
    setBillingError(null);
    try {
      const { url } = await createPortal(profile.email);
      window.location.href = url;
    } catch (e) {
      setBillingError(e instanceof Error ? e.message : 'Portal failed');
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
    <MenuSheet title="Your account" onClose={onClose}>
      <section className="savings-card">
        <span className="savings-card-label">Saved this year</span>
        <strong className="savings-card-amount">
          €{(savings?.ytd_savings ?? 0).toFixed(2)}
        </strong>
        <span className="savings-card-sub">
          {savings && savings.bookings_count > 0
            ? `Across ${savings.bookings_count} partner ${savings.bookings_count === 1 ? 'booking' : 'bookings'} vs nearby public rates`
            : 'Book a discounted partner site to start saving vs public chargers nearby'}
        </span>
      </section>

      {bookings.length > 0 && (
        <section className="account-section">
          <label className="field-label">Your partner bookings</label>
          <div className="booking-list">
            {bookings.map((b) => (
              <div key={b.id} className="booking-row">
                <div className="booking-row-main">
                  <strong>{b.partner_site_name ?? 'Partner site'}</strong>
                  <span>{fmtSlot(b)}</span>
                  {b.nearby_avg_price != null && b.partner_price != null && (
                    <span className="booking-row-compare">
                      €{b.partner_price.toFixed(2)} vs €{b.nearby_avg_price.toFixed(2)}/kWh avg nearby
                    </span>
                  )}
                </div>
                <div className="booking-row-side">
                  {b.session_savings != null && (
                    <span className="booking-row-savings">+€{b.session_savings.toFixed(2)}</span>
                  )}
                  <button type="button" className="booking-cancel" onClick={() => cancelBooking(b.id)}>
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
        {billingError && <p className="billing-error">{billingError}</p>}
      </section>
    </MenuSheet>
  );
}
