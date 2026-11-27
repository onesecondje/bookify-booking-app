import { canViewBusinessDashboard } from '@/lib/business-dashboard-auth';
import { getBusinessBookings } from '@/lib/business-bookings';
import { getBusinessSchedule } from '@/lib/business-schedule';
import { getBusinessServices } from '@/lib/business-services';
import type { BusinessBooking } from '@/lib/types/business-bookings.types';
import { isUuid } from '@/lib/validation/uuid';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from './business-bookings.module.css';
import { BusinessServices } from './business-services';
import { CancelBookingForm } from './cancel-booking-form';
import { bookingFilters } from './constants/booking-filters';
import { BookingFilter } from './enums/booking-filter.enum';
import { ReviewBookingForm } from './review-booking-form';
import type { BusinessDashboardProps } from './types/business-dashboard.types';
import { WeeklySchedule } from './weekly-schedule';

function getBookingStatus({ approvedAt, cancelledAt }: BusinessBooking) {
  if (cancelledAt) {
    return approvedAt ? 'Cancelled' : 'Rejected';
  }
  return approvedAt ? 'Confirmed' : 'Pending confirmation';
}

export default async function BusinessDashboard({ searchParams }: BusinessDashboardProps) {
  if (!canViewBusinessDashboard((await headers()).get('authorization'))) {
    notFound();
  }

  const { specialistId, bookingStatus } = await searchParams;
  const selectedId = isUuid(specialistId) ? specialistId : undefined;
  const invalidSelection = specialistId !== undefined && selectedId === undefined;
  const activeFilter =
    bookingFilters.find(({ value }) => value === bookingStatus) ?? bookingFilters[0];
  const [bookings, schedule, services] = await Promise.all([
    getBusinessBookings(),
    getBusinessSchedule(selectedId),
    getBusinessServices(),
  ]);
  const visibleBookings =
    activeFilter.status === null
      ? bookings
      : (bookings?.filter((booking) => getBookingStatus(booking) === activeFilter.status) ?? null);
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
      <nav className={styles.bookingFilters} aria-label="Booking status">
        {bookingFilters.map(({ value, label }) => {
          const query = new URLSearchParams();
          if (selectedId) {
            query.set('specialistId', selectedId);
          }
          if (value !== BookingFilter.All) {
            query.set('bookingStatus', value);
          }
          return (
            <Link
              key={value}
              href={query.size ? `/business?${query}` : '/business'}
              aria-current={value === activeFilter.value ? 'page' : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {visibleBookings === null ? (
        <p role="status">Bookings are unavailable. Refresh the page to try again.</p>
      ) : visibleBookings.length === 0 ? (
        <p>{activeFilter.emptyMessage}</p>
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
                <th scope="col">Rejected or cancelled at (UTC)</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleBookings.map((booking) => (
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
                  <td>{getBookingStatus(booking)}</td>
                  <td>
                    {booking.cancelledAt ? (
                      <time dateTime={booking.cancelledAt}>
                        {dateTime.format(new Date(booking.cancelledAt))}
                      </time>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {!booking.cancelledAt &&
                      (booking.approvedAt ? (
                        <CancelBookingForm bookingId={booking.id} />
                      ) : (
                        <ReviewBookingForm bookingId={booking.id} />
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <BusinessServices
        services={services}
        specialists={schedule?.specialists.filter(({ isActive }) => isActive) ?? null}
      />
      <WeeklySchedule
        result={schedule}
        invalidSelection={invalidSelection}
        bookingFilter={activeFilter.value}
      />
    </main>
  );
}
