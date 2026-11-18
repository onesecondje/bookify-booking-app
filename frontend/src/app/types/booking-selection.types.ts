import type { ServiceSummary } from '@/lib/types/services.types';
import type { BookingSelection } from '@/lib/types/booking-confirmation.types';

type SearchParams = Record<string, string | string[] | undefined>;

export type ServiceSelectionProps = { searchParams: Promise<SearchParams> };

export type AppointmentSearchParams = {
  date: SearchParams[string];
  startsAt: SearchParams[string];
  bookingConflict: boolean;
};

export type SpecialistSelectionProps = AppointmentSearchParams & {
  service: ServiceSummary;
  specialistId: SearchParams[string];
};

export type AppointmentSelectionProps = AppointmentSearchParams & {
  serviceId: string;
  specialistId: string;
};

export type AvailabilitySlotsProps = Omit<AppointmentSelectionProps, 'date' | 'bookingConflict'> & {
  date: string;
};

export type BookingConfirmationProps = {
  selection: BookingSelection;
  timeLabel: string;
  timeZone: string;
};
