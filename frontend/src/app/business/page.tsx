import { canViewBusinessDashboard } from '@/lib/business-dashboard-auth';
import { getBusinessBookings } from '@/lib/business-bookings';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import styles from './business-bookings.module.css';

export default async function BusinessDashboard() {
  if (!canViewBusinessDashboard((await headers()).get('authorization'))) notFound();

  const bookings = await getBusinessBookings();
  const dateTime = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });

  return (
    <main className={styles.dashboard}>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
