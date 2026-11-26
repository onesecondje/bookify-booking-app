export interface ServiceDetails {
  name: string;
  durationMinutes: number;
}

export interface ServiceUpdate extends ServiceDetails {
  isActive: boolean;
}

export interface ServiceCreation extends ServiceDetails {
  specialistIds: string[];
}
