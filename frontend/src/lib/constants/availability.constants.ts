import { AvailabilityLoadStatus } from '../../enums/availability-load-status.enum';

export const availabilityNotFoundStatuses: ReadonlyMap<
  string,
  Exclude<AvailabilityLoadStatus, AvailabilityLoadStatus.Ready>
> = new Map([
  ['BUSINESS_NOT_FOUND', AvailabilityLoadStatus.BusinessNotFound],
  ['SERVICE_NOT_FOUND', AvailabilityLoadStatus.ServiceNotFound],
  ['SPECIALIST_NOT_FOUND', AvailabilityLoadStatus.SpecialistNotFound],
] as const);
