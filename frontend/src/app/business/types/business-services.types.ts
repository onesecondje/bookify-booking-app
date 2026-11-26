import type {
  BusinessService,
  BusinessServiceSpecialist,
} from '@/lib/types/business-services.types';

export interface BusinessServicesProps {
  services: BusinessService[] | null;
  specialists: BusinessServiceSpecialist[] | null;
}

export interface ServiceCreateFormProps {
  specialists: BusinessServiceSpecialist[];
}

export interface ServiceEditFormProps {
  service: BusinessService;
  specialists: BusinessServiceSpecialist[] | null;
}

export interface ServiceSpecialistChoicesProps {
  specialists: BusinessServiceSpecialist[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
}

export interface ServiceFormState {
  saved: boolean;
  message: string;
}
