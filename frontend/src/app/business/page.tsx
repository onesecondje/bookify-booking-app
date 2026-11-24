import { canViewBusinessDashboard } from '@/lib/business-dashboard-auth';
import { getBusinessBookings } from '@/lib/business-bookings';
import { getBusinessSchedule } from '@/lib/business-schedule';
import { isUuid } from '@/lib/validation/uuid';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from './business-bookings.module.css';
import { CancelBookingForm } from './cancel-booking-form';
import type { BusinessDashboardProps } from './types/business-dashboard.types';
import { WeeklySchedule } from './weekly-schedule';

export default async function BusinessDashboard({ searchParams }: BusinessDashboardProps) {
  if (!canViewBusinessDashboard((await headers()).get('authorization'))) notFound();

  const { specialistId } = await searchParams;
  const selectedId = isUuid(specialistId) ? specialistId : undefined;
  const invalidSelection = specialistId !== undefined && selectedId === undefined;
  const [bookings, schedule] = await Promise.all([
    getBusinessBookings(),
    getBusinessSchedule(selectedId),
  ]);
  const dateTime = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });

  return (
    <main className={styles.dashboard}>
      <Link className={styles.backLink} href="/">
        Back to booking
      </Link>
      <h1>Upcoming bookings</h1>
      {bookings === null ? (
        <p role="status">Bookings are unavailable. Refresh the page to try again.</p>
      ) : bookings.length === 0 ? (
        <p>No upcoming bookings.</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table} aria-label="Upcoming bookings">
            <thead>
              <tr>
                <th scope="col">Time (UTC)</th>
                <th scope="col">Service</th>
                <th scope="col">Specialist</th>
                <th scope="col">Customer</th>
                <th scope="col">Phone</th>
                <th scope="col">Status</th>
                <th scope="col">Cancelled at (UTC)</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <time dateTime={booking.startsAt}>
                      {dateTime.format(new Date(booking.startsAt))}
                    </time>
                    <br />
                    <time dateTime={booking.endsAt}>
                      {dateTime.format(new Date(booking.endsAt))}
                    </time>
                  </td>
                  <td>{booking.service.name}</td>
                  <td>{booking.specialist.name}</td>
                  <td>{booking.customerName ?? 'Not provided'}</td>
                  <td>{booking.customerPhone ?? 'Not provided'}</td>
                  <td>{booking.cancelledAt ? 'Cancelled' : 'Confirmed'}</td>
                  <td>
                    {booking.cancelledAt ? (
                      <time dateTime={booking.cancelledAt}>
                        {dateTime.format(new Date(booking.cancelledAt))}
                      </time>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{!booking.cancelledAt && <CancelBookingForm bookingId={booking.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <WeeklySchedule result={schedule} invalidSelection={invalidSelection} />
    </main>
  );
}
