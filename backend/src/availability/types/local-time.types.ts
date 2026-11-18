import type { LocalTimeStatus } from '../../enums/local-time-status.enum.js';

export type LocalTimeResult =
  | { status: LocalTimeStatus.Unique; utc: string }
  | { status: LocalTimeStatus.Ambiguous; earlierUtc: string; laterUtc: string }
  | { status: LocalTimeStatus.Nonexistent };
