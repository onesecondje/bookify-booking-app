import type { ServiceSummary } from '@/lib/types/services.types';

type SearchParams = Record<string, string | string[] | undefined>;

export type ServiceSelectionProps = { searchParams: Promise<SearchParams> };

export type AppointmentSearchParams = {
  date: SearchParams[string];
  startsAt: SearchParams[string];
};

export type SpecialistSelectionProps = AppointmentSearchParams & {
  service: ServiceSummary;
  specialistId: SearchParams[string];
};

export type AppointmentSelectionProps = AppointmentSearchParams & {
  serviceId: string;
  specialistId: string;
};

export type AvailabilitySlotsProps = Omit<AppointmentSelectionProps, 'date'> & { date: string };
