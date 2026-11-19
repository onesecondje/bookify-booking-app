import { Suspense } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { Services } from './services';
import type { ServiceSelectionProps } from './types/booking-selection.types';

export default function Home({ searchParams }: ServiceSelectionProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Bookify home">
          bookify<span aria-hidden="true">.</span>
        </Link>
        <a className={styles.dashboardLink} href="/business">
          Business dashboard
        </a>
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
