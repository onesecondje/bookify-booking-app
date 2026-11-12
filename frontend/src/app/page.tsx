import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { getBusinessServices } from '@/lib/services';
import { isUuid } from '@/lib/validation/uuid';
import { Specialists } from './specialists';
import styles from './page.module.css';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function Services({ searchParams }: { searchParams: SearchParams }) {
  // Fetch at request time, so building the frontend does not require a running API.
  await connection();
  const result = await getBusinessServices();
  const { serviceId } = await searchParams;

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

  const validServiceId = isUuid(serviceId) ? serviceId.toLowerCase() : undefined;
  const selectedService = result.services.find((service) => service.id === validServiceId);

  return (
    <>
      <p className={styles.count}>{result.services.length} available services</p>
      <ul className={styles.list}>
        {result.services.map((service) => (
          <li key={service.id}>
            <Link
              className={`${styles.service} ${selectedService?.id === service.id ? styles.selectedService : ''}`}
              href={`/?serviceId=${service.id}`}
              scroll={false}
              aria-current={selectedService?.id === service.id ? 'true' : undefined}
            >
              <h3>{service.name}</h3>
              <p>
                <span className={styles.clock} aria-hidden="true">
                  ◷
                </span>{' '}
                {service.durationMinutes} min
              </p>
              <span className={styles.selectionLabel}>
                {selectedService?.id === service.id ? 'Selected' : 'Select service'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <section className={styles.specialists} aria-labelledby="specialists-title">
        <div className={styles.sectionHeading}>
          <h2 id="specialists-title">Specialists</h2>
          {serviceId !== undefined && (
            <Link href="/" scroll={false}>
              Clear selection
            </Link>
          )}
        </div>
        {serviceId === undefined ? (
          <p className={styles.state}>Select a service to see its specialists.</p>
        ) : !validServiceId ? (
          <div className={styles.state} role="status">
            <h3>Invalid service selection</h3>
            <p>Please select a service from the list above.</p>
          </div>
        ) : !selectedService ? (
          <div className={styles.state} role="status">
            <h3>Service unavailable</h3>
            <p>This service is no longer available. Please select another service.</p>
          </div>
        ) : (
          <Suspense
            key={selectedService.id}
            fallback={
              <p className={styles.state} role="status">
                Loading specialists…
              </p>
            }
          >
            <Specialists service={selectedService} />
          </Suspense>
        )}
      </section>
    </>
  );
}

export default function Home({ searchParams }: { searchParams: SearchParams }) {
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
            <Services searchParams={searchParams} />
          </Suspense>
        </section>
      </main>
      <footer className={styles.footer}>Bookify · Service appointments, made simple.</footer>
    </div>
  );
}
