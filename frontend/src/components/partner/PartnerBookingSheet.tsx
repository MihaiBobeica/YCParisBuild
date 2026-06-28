import { useEffect, useMemo, useState } from 'react';
import {
  createPartnerBooking,
  fetchPartnerAvailability,
  type SlotAvailability,
} from '../../api/client';
import type { PartnerSite } from '../../data/partnerSites';
import { MenuSheet } from '../layout/MenuSheet';

const TZ = 'Europe/Amsterdam';

interface Props {
  site: PartnerSite;
  email: string;
  onSetEmail: (email: string) => void;
  onBooked: () => void;
  onClose: () => void;
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  });
}

function dayLabel(key: string): { title: string; sub: string } {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: TZ });
  const d = new Date(`${key}T12:00:00`);
  const sub = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
  if (key === today) return { title: 'Today', sub };
  if (key === tomorrow) return { title: 'Tomorrow', sub };
  return { title: d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: TZ }), sub };
}

export function PartnerBookingSheet({ site, email, onSetEmail, onBooked, onClose }: Props) {
  const [slots, setSlots] = useState<SlotAvailability[] | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = async () => {
    try {
      const data = await fetchPartnerAvailability(site.id);
      setSlots(data);
    } catch {
      setSlots([]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id]);

  const days = useMemo(() => {
    if (!slots) return [];
    const keys: string[] = [];
    const byDay = new Map<string, SlotAvailability[]>();
    for (const s of slots) {
      const k = dayKey(s.slot_start);
      if (!byDay.has(k)) {
        byDay.set(k, []);
        keys.push(k);
      }
      byDay.get(k)!.push(s);
    }
    return keys.map((k) => ({ key: k, ...dayLabel(k), slots: byDay.get(k)! }));
  }, [slots]);

  const toggle = (slot: SlotAvailability) => {
    if (slot.remaining <= 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slot.slot_start)) next.delete(slot.slot_start);
      else next.add(slot.slot_start);
      return next;
    });
  };

  const confirm = async () => {
    if (!email) {
      setError('Add your email above to reserve.');
      return;
    }
    if (selected.size === 0 || !slots) return;
    setSubmitting(true);
    setError(null);
    const chosen = slots.filter((s) => selected.has(s.slot_start));
    try {
      await createPartnerBooking({
        email,
        partner_site_id: site.id,
        slots: chosen.map((s) => ({ start: s.slot_start, end: s.slot_end })),
      });
      setDone(true);
      setSelected(new Set());
      await load();
      onBooked();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Booking failed';
      setError(msg.includes('409') || /fully booked/i.test(msg) ? 'One of those blocks just filled up. Try another.' : 'Booking failed. Please try again.');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const activeSlots = days[activeDay]?.slots ?? [];

  return (
    <MenuSheet title="Reserve a charging slot" onClose={onClose}>
      <div className="partner-sheet-head">
        <div className="partner-sheet-titles">
          <strong>{site.name}</strong>
          <span>{site.address}</span>
        </div>
        <div className="partner-rate-badge">
          €{site.energy_price.toFixed(2)}/kWh · {Math.round(site.max_power_kw)} kW
        </div>
      </div>

      {!email && (
        <div className="partner-email-row">
          <label className="field-label">Email (to hold your reservation)</label>
          <input
            className="field-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => onSetEmail(e.target.value)}
          />
        </div>
      )}

      {done && (
        <div className="partner-booking-success">Reservation confirmed. See it in your account.</div>
      )}

      {slots === null ? (
        <p className="field-hint partner-loading">Loading available times…</p>
      ) : days.length === 0 ? (
        <p className="field-hint">No upcoming slots available.</p>
      ) : (
        <>
          <div className="partner-day-tabs">
            {days.map((d, i) => (
              <button
                key={d.key}
                type="button"
                className={`partner-day-tab${i === activeDay ? ' active' : ''}`}
                onClick={() => setActiveDay(i)}
              >
                <strong>{d.title}</strong>
                <span>{d.sub}</span>
              </button>
            ))}
          </div>

          <div className="partner-slot-list">
            {activeSlots.map((s) => {
              const full = s.remaining <= 0;
              const isSel = selected.has(s.slot_start);
              return (
                <button
                  key={s.slot_start}
                  type="button"
                  disabled={full}
                  className={`partner-slot${isSel ? ' selected' : ''}${full ? ' full' : ''}`}
                  onClick={() => toggle(s)}
                >
                  <span className="partner-slot-radio" aria-hidden />
                  <span className="partner-slot-time">
                    {fmtTime(s.slot_start)} – {fmtTime(s.slot_end)}
                  </span>
                  <span className="partner-slot-cap">
                    {full ? 'Full' : `${s.remaining} / ${s.total_slots} free`}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="partner-booking-error">{error}</p>}

      <button
        type="button"
        className="partner-confirm-btn"
        disabled={submitting || selected.size === 0}
        onClick={confirm}
      >
        {submitting
          ? 'Reserving…'
          : selected.size > 0
            ? `Reserve ${selected.size} slot${selected.size > 1 ? 's' : ''}`
            : 'Select a time slot'}
      </button>
    </MenuSheet>
  );
}
