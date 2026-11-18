import { AvailabilityLoadStatus } from '@/enums/availability-load-status.enum';
import { getSpecialistAvailability } from '@/lib/availability';
import { formatSlotTimes } from '@/lib/format-slot-times';
import { isLocalDate } from '@/lib/validation/local-date';
import Link from 'next/link';
import { Suspense } from 'react';
import styles from './page.module.css';
import type {
  AppointmentSelectionProps,
  AvailabilitySlotsProps,
} from './types/booking-selection.types';

async function AvailabilitySlots({
  serviceId,
  specialistId,
  date,
  startsAt,
}: AvailabilitySlotsProps) {
  const result = await getSpecialistAvailability(serviceId, specialistId, date);
  const dateQuery = new URLSearchParams({ serviceId, specialistId, date });

  if (result.status === AvailabilityLoadStatus.Unavailable) {
    return (
      <div role="status">
        <p>We couldn’t load available times. Please try again.</p>
        <form action="/" method="get">
          <input type="hidden" name="serviceId" value={serviceId} />
          <input type="hidden" name="specialistId" value={specialistId} />
          <input type="hidden" name="date" value={date} />
          {typeof startsAt === 'string' && <input type="hidden" name="startsAt" value={startsAt} />}
          <button className={styles.retry} type="submit">
            Try again
          </button>
        </form>
      </div>
    );
  }

  if (result.status !== AvailabilityLoadStatus.Ready) {
    return (
      <p role="status">
        This selection is no longer available. Please select a service and specialist again.
      </p>
    );
  }

  const { timeZone, slots, unresolvedPeriodCount } = result.availability;
  const selectedSlot = slots.find((slot) => slot.startsAt === startsAt);
  const labels = formatSlotTimes(slots, timeZone);

  return (
    <div className={styles.slotResults}>
      <p>Times shown in {timeZone}.</p>
      {startsAt !== undefined && !selectedSlot && (
        <p role="status">
          The selected time is no longer available. Please choose another time or date.
        </p>
      )}
      {slots.length === 0 ? (
        <p role="status">No available times for this date. Please choose another date.</p>
      ) : (
        <ul className={styles.slots} aria-label="Available times">
          {slots.map((slot, index) => {
            const isSelected = slot === selectedSlot;
            const slotQuery = new URLSearchParams(dateQuery);
            slotQuery.set('startsAt', slot.startsAt);
            return (
              <li key={slot.startsAt}>
                <Link
                  href={`/?${slotQuery}`}
                  className={`${styles.slot} ${isSelected ? styles.selectedService : ''}`}
                  aria-current={isSelected ? 'true' : undefined}
                  prefetch={false}
                  scroll={false}
                >
                  <time dateTime={slot.startsAt}>{labels[index]}</time>
                  {isSelected && <span className={styles.selectionLabel}>Selected</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {selectedSlot && (
        <Link href={`/?${dateQuery}`} className={styles.clearTime} prefetch={false} scroll={false}>
          Clear time selection
        </Link>
      )}
      {unresolvedPeriodCount > 0 && <p>Some working hours could not be shown for this date.</p>}
    </div>
  );
}

export function AppointmentSelection({
  serviceId,
  specialistId,
  date,
  startsAt,
}: AppointmentSelectionProps) {
  const validDate = isLocalDate(date) ? date : undefined;
  const invalidDate = date !== undefined && validDate === undefined;

  return (
    <section className={styles.state} aria-labelledby="appointment-title">
      <h3 id="appointment-title">Choose a date and time</h3>
      <form action="/" method="get" className={styles.dateForm}>
        <input type="hidden" name="serviceId" value={serviceId} />
        <input type="hidden" name="specialistId" value={specialistId} />
        <label className={styles.dateField}>
          Appointment date
          <input
            key={validDate ?? ''}
            type="date"
            name="date"
            defaultValue={validDate}
            aria-invalid={invalidDate || undefined}
            aria-describedby={invalidDate ? 'appointment-date-error' : undefined}
            required
          />
        </label>
        <button className={styles.retry} type="submit">
          Show times
        </button>
      </form>
      {invalidDate && (
        <p id="appointment-date-error" role="status">
          Choose a valid calendar date.
        </p>
      )}
      {validDate && (
        <Suspense
          key={JSON.stringify([serviceId, specialistId, validDate, startsAt])}
          fallback={<p role="status">Loading available times…</p>}
        >
          <AvailabilitySlots
            serviceId={serviceId}
            specialistId={specialistId}
            date={validDate}
            startsAt={startsAt}
          />
        </Suspense>
      )}
    </section>
  );
}
