import type { ServiceSummary } from './services.types';
import type { SpecialistSummary } from './specialists.types';

export interface BusinessServiceSpecialist extends SpecialistSummary {
  isActive: boolean;
}

export interface BusinessService extends ServiceSummary {
  isActive: boolean;
  specialists: BusinessServiceSpecialist[];
}
