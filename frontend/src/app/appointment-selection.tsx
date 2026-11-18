import { isLocalDate } from '@/lib/validation/local-date';
import { Suspense } from 'react';
import { AvailabilitySlots } from './availability-slots';
import styles from './page.module.css';
import type { AppointmentSelectionProps } from './types/booking-selection.types';

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
