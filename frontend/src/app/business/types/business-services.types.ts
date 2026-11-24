import type { BusinessService, BusinessServiceUpdate } from '@/lib/types/business-services.types';

export interface BusinessServicesProps {
  services: BusinessService[] | null;
}

export interface ServiceEditFormProps {
  serviceId: string;
  initialValues: BusinessServiceUpdate;
}

export interface ServiceEditState {
  saved: boolean;
  message: string;
}
