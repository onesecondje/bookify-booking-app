import { SpecialistsLoadStatus } from '@/enums/specialists-load-status.enum';
import type { ServiceSummary } from '@/lib/services.schema';
import { getServiceSpecialists } from '@/lib/specialists';
import { isUuid } from '@/lib/validation/uuid';
import Link from 'next/link';
import styles from './page.module.css';

export async function Specialists({
  service,
  specialistId,
}: {
  service: ServiceSummary;
  specialistId: string | string[] | undefined;
}) {
  const result = await getServiceSpecialists(service.id);

  if (result.status === SpecialistsLoadStatus.Unavailable) {
    return (
      <div className={styles.state} role="status">
        <h3>Specialists are temporarily unavailable</h3>
        <p>We couldn’t load specialists for {service.name}. Please try again.</p>
        <form action="/" method="get">
          <input type="hidden" name="serviceId" value={service.id} />
          {isUuid(specialistId) && <input type="hidden" name="specialistId" value={specialistId} />}
          <button className={styles.retry} type="submit">
            Try again
          </button>
        </form>
      </div>
    );
  }

  if (result.status === SpecialistsLoadStatus.BusinessNotFound) {
    return (
      <div className={styles.state} role="status">
        <h3>Business not found</h3>
        <p>This business is currently unavailable.</p>
      </div>
    );
  }

  if (result.status !== SpecialistsLoadStatus.Ready) {
    return (
      <div className={styles.state} role="status">
        <h3>Service unavailable</h3>
        <p>This service is no longer available. Please select another service.</p>
      </div>
    );
  }

  if (result.specialists.length === 0) {
    return (
      <div className={styles.state} role="status">
        <h3>No specialists available</h3>
        <p>
          No active specialists currently provide {service.name}. Please select another service.
        </p>
      </div>
    );
  }

  const validSpecialistId = isUuid(specialistId) ? specialistId.toLowerCase() : undefined;
  const selectedSpecialist = result.specialists.find(
    (specialist) => specialist.id.toLowerCase() === validSpecialistId,
  );

  return (
    <>
      <p className={styles.count}>Specialists for {service.name}</p>
      <ul className={styles.list}>
        {result.specialists.map((specialist) => (
          <li key={specialist.id}>
            <Link
              href={`/?serviceId=${service.id}&specialistId=${specialist.id}`}
              scroll={false}
              className={`${styles.service} ${selectedSpecialist?.id === specialist.id ? styles.selectedService : ''}`}
              aria-current={selectedSpecialist?.id === specialist.id ? 'true' : undefined}
            >
              <h3>{specialist.name}</h3>
              <span className={styles.selectionLabel}>
                {selectedSpecialist?.id === specialist.id ? 'Selected' : 'Select specialist'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {specialistId === undefined ? (
        <p className={styles.count}>Select a specialist to review your selection.</p>
      ) : !validSpecialistId ? (
        <div className={styles.state} role="status">
          <h3>Invalid specialist selection</h3>
          <p>Please select a specialist from the list above.</p>
        </div>
      ) : !selectedSpecialist ? (
        <div className={styles.state} role="status">
          <h3>Specialist unavailable</h3>
          <p>This specialist is not currently available for this service. Please choose another.</p>
        </div>
      ) : (
        <section className={styles.state} aria-labelledby="selection-title">
          <h3 id="selection-title">Your selection</h3>
          <dl className={styles.summary}>
            <div>
              <dt>Service</dt>
              <dd>{service.name}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{service.durationMinutes} min</dd>
            </div>
            <div>
              <dt>Specialist</dt>
              <dd>{selectedSpecialist.name}</dd>
            </div>
          </dl>
          <p>No appointment has been booked.</p>
          <Link className={styles.retry} href={`/?serviceId=${service.id}`} scroll={false}>
            Clear specialist selection
          </Link>
        </section>
      )}
    </>
  );
}
