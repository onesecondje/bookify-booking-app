export interface ServiceDetails {
  name: string;
  durationMinutes: number;
}

export interface ServiceUpdate extends ServiceDetails {
  isActive: boolean;
  specialistIds?: string[];
}

export interface ServiceCreation extends ServiceDetails {
  specialistIds: string[];
}
