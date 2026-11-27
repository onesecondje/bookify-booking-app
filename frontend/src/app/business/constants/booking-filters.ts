import { BookingFilter } from '../enums/booking-filter.enum';

export const bookingFilters = [
  {
    value: BookingFilter.All,
    label: 'All bookings',
    status: null,
    emptyMessage: 'No upcoming bookings.',
  },
  {
    value: BookingFilter.Confirmed,
    label: 'Confirmed bookings',
    status: 'Confirmed',
    emptyMessage: 'No upcoming confirmed bookings.',
  },
  {
    value: BookingFilter.Rejected,
    label: 'Rejected bookings',
    status: 'Rejected',
    emptyMessage: 'No upcoming rejected bookings.',
  },
] as const;
