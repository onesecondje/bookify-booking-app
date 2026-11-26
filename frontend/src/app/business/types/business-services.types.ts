import type { BusinessService, BusinessServiceUpdate } from '@/lib/types/business-services.types';
import type { SpecialistSummary } from '@/lib/types/specialists.types';

export interface BusinessServicesProps {
  services: BusinessService[] | null;
  specialists: SpecialistSummary[] | null;
}

export interface ServiceCreateFormProps {
  specialists: SpecialistSummary[];
}

export interface ServiceEditFormProps {
  serviceId: string;
  initialValues: BusinessServiceUpdate;
}

export interface ServiceFormState {
  saved: boolean;
  message: string;
}
