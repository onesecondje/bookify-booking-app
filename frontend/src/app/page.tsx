import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { getBusinessServices } from '@/lib/services';
import styles from './page.module.css';

async function Services() {
  // Fetch at request time, so building the frontend does not require a running API.
  await connection();
  const result = await getBusinessServices();

  if (result.status === 'unavailable') {
    return (
      <div className={styles.state} role="status">
        <h3>Services are temporarily unavailable</h3>
        <p>We couldn’t load the services. Please try again in a moment.</p>
        <form action="/" method="get">
          <button className={styles.retry} type="submit">
            Try again
          </button>
        </form>
      </div>
    );
  }

  if (result.status === 'not-found') {
    return (
      <div className={styles.state} role="status">
        <h3>Business not found</h3>
        <p>This business is currently unavailable.</p>
      </div>
    );
  }

  if (result.services.length === 0) {
    return (
      <div className={styles.state} role="status">
        <h3>No services available yet</h3>
        <p>Please check back later for available services.</p>
      </div>
    );
  }

  return (
    <>
      <p className={styles.count}>{result.services.length} available services</p>
      <ul className={styles.list}>
        {result.services.map((service) => (
          <li className={styles.service} key={service.id}>
            <h3>{service.name}</h3>
            <p>
              <span className={styles.clock} aria-hidden="true">
                ◷
              </span>{' '}
              {service.durationMinutes} min
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Bookify home">
          bookify<span aria-hidden="true">.</span>
        </Link>
        <span className={styles.headerLabel}>A little time for you</span>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Service catalogue</p>
          <h1>Make time for yourself.</h1>
          <p className={styles.description}>Explore our services and find the time you need.</p>
        </div>
        <section className={styles.catalogue} aria-labelledby="services-title">
          <div className={styles.sectionHeading}>
            <h2 id="services-title">Our services</h2>
            <span>Duration at a glance</span>
          </div>
          <Suspense
            fallback={
              <p className={styles.state} role="status">
                Loading services…
              </p>
            }
          >
            <Services />
          </Suspense>
        </section>
      </main>
      <footer className={styles.footer}>Bookify · Service appointments, made simple.</footer>
    </div>
  );
}
