import { useEffect, useMemo, useState } from 'react';
import {
  createPartnerBooking,
  fetchPartnerAvailability,
  type SlotAvailability,
} from '../../api/client';
import type { PartnerSite } from '../../data/partnerSites';

const TZ = 'Europe/Amsterdam';
const SLOT_BLOCK_HOURS = 2;
const PRICE_LOW = 0.2;
const PRICE_HIGH = 0.5;
const PRICE_GREEN_MAX = 0.3;
const PRICE_VALLEY_START = 10;
const PRICE_VALLEY_END = 16;
const PRICE_DAY_START = 6;
const PRICE_DAY_END = 22;

interface Props {
  site: PartnerSite;
  email: string;
  onBooked: () => void;
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

/** Static mock: ~€0.20/kWh between 10:00–16:00, linear ramp to ~€0.50 at day edges. */
function predictedSlotPrice(slotStartIso: string): number {
  const d = new Date(slotStartIso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')!.value);
  const minute = Number(parts.find((p) => p.type === 'minute')!.value);
  const mid = hour + minute / 60 + SLOT_BLOCK_HOURS / 2;

  if (mid >= PRICE_VALLEY_START && mid < PRICE_VALLEY_END) return PRICE_LOW;
  if (mid < PRICE_VALLEY_START) {
    const t = (mid - PRICE_DAY_START) / (PRICE_VALLEY_START - PRICE_DAY_START);
    const clamped = Math.max(0, Math.min(1, t));
    return PRICE_HIGH - (PRICE_HIGH - PRICE_LOW) * clamped;
  }
  const t = (mid - PRICE_VALLEY_END) / (PRICE_DAY_END - PRICE_VALLEY_END);
  const clamped = Math.max(0, Math.min(1, t));
  return PRICE_LOW + (PRICE_HIGH - PRICE_LOW) * clamped;
}

function fmtPredictedPrice(eurPerKwh: number, estimated: boolean): string {
  const price = `€${eurPerKwh.toFixed(2)}/kWh`;
  return estimated ? `Est. ${price}` : price;
}

function SlotPriceLabel({
  text,
  lowPrice,
  estimated,
}: {
  text: string;
  lowPrice: boolean;
  estimated: boolean;
}) {
  return (
    <span
      className={`partner-slot-price${lowPrice ? ' partner-slot-price--low' : ''}${estimated ? ' partner-slot-price--estimated' : ''}`}
      title={estimated ? 'Estimated price for this upcoming slot' : undefined}
    >
      {text}
    </span>
  );
}

function isFutureSlot(slotStartIso: string): boolean {
  return new Date(slotStartIso).getTime() > Date.now();
}

export function PartnerBookingPanel({ site, email, onBooked }: Props) {
  const [slots, setSlots] = useState<SlotAvailability[] | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [done, setDone] = useState(false);

  const load = async () => {
    setLoadError(false);
    try {
      const data = await fetchPartnerAvailability(site.id);
      setSlots(data);
    } catch {
      setLoadError(true);
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
      setError('Sign in to reserve a slot.');
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
      if (msg.includes('503') || /temporarily unavailable/i.test(msg)) {
        setError('Booking is temporarily unavailable. Try again in a moment.');
      } else if (msg.includes('409') || /fully booked/i.test(msg)) {
        setError('One of those blocks just filled up. Try another.');
      } else {
        setError('Booking failed. Please try again.');
      }
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const activeSlots = days[activeDay]?.slots ?? [];

  return (
    <div className="partner-booking-panel">
      {done && (
        <div className="partner-booking-success">Reservation confirmed. See it in your account.</div>
      )}

      {slots === null ? (
        <p className="field-hint partner-loading">Loading available times…</p>
      ) : loadError ? (
        <button type="button" className="partner-retry" onClick={load}>
          Couldn’t load times. Tap to retry.
        </button>
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

          <p className="partner-slot-price-hint">Estimated prices for upcoming time slots.</p>

          <div className="partner-slot-list">
            {activeSlots.map((s) => {
              const full = s.remaining <= 0;
              const isSel = selected.has(s.slot_start);
              const predicted = predictedSlotPrice(s.slot_start);
              const estimated = isFutureSlot(s.slot_start);
              const lowPrice = predicted < PRICE_GREEN_MAX;
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
                  <SlotPriceLabel
                    text={fmtPredictedPrice(predicted, estimated)}
                    lowPrice={lowPrice}
                    estimated={estimated}
                  />
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
    </div>
  );
}
