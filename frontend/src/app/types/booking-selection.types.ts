import type { ServiceSummary } from '@/lib/types/services.types';

type SearchParams = Record<string, string | string[] | undefined>;

export type ServiceSelectionProps = { searchParams: Promise<SearchParams> };

export type SpecialistSelectionProps = {
  service: ServiceSummary;
  specialistId: SearchParams[string];
};
