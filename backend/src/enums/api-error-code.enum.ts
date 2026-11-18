export enum ApiErrorCode {
  InvalidBusinessId = 'INVALID_BUSINESS_ID',
  InvalidServiceId = 'INVALID_SERVICE_ID',
  InvalidSpecialistId = 'INVALID_SPECIALIST_ID',
  InvalidDate = 'INVALID_DATE',
  BusinessNotFound = 'BUSINESS_NOT_FOUND',
  ServiceNotFound = 'SERVICE_NOT_FOUND',
  SpecialistNotFound = 'SPECIALIST_NOT_FOUND',
  NotFound = 'NOT_FOUND',
  InvalidJson = 'INVALID_JSON',
  PayloadTooLarge = 'PAYLOAD_TOO_LARGE',
  UnsupportedMediaType = 'UNSUPPORTED_MEDIA_TYPE',
  InternalServerError = 'INTERNAL_SERVER_ERROR',
}
