import { ApiErrorCode } from '../../enums/api-error-code.enum.js';

export const availabilityIdErrors = [
  ['businessId', ApiErrorCode.InvalidBusinessId],
  ['serviceId', ApiErrorCode.InvalidServiceId],
  ['specialistId', ApiErrorCode.InvalidSpecialistId],
] as const;
