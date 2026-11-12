import { SpecialistsLoadStatus } from '@/enums/specialists-load-status.enum';
import type { ServiceSummary } from '@/lib/services.schema';
import { getServiceSpecialists } from '@/lib/specialists';
import styles from './page.module.css';

export async function Specialists({ service }: { service: ServiceSummary }) {
  const result = await getServiceSpecialists(service.id);

  if (result.status === SpecialistsLoadStatus.Unavailable) {
    return (
      <div className={styles.state} role="status">
        <h3>Specialists are temporarily unavailable</h3>
        <p>We couldn’t load specialists for {service.name}. Please try again.</p>
        <form action="/" method="get">
          <input type="hidden" name="serviceId" value={service.id} />
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

  return (
    <>
      <p className={styles.count}>Specialists for {service.name}</p>
      <ul className={styles.list}>
        {result.specialists.map((specialist) => (
          <li className={styles.service} key={specialist.id}>
            <h3>{specialist.name}</h3>
          </li>
        ))}
      </ul>
    </>
  );
}
