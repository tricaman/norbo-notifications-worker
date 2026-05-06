export interface ReminderConfig {
  // Offset from ping creation time, in seconds
  offsetSeconds: number;
  // Human label for logging
  label: string;
}

export const REMINDER_SCHEDULE: Record<
  'SHORT' | 'MEDIUM' | 'LONG',
  ReminderConfig[]
> = {
  // 1h ping: remind at 30m and 55m
  SHORT: [
    { offsetSeconds: 1800, label: '30m reminder' },
    { offsetSeconds: 3300, label: '55m reminder' },
  ],
  // 6h ping: remind at 1h, 3h, 5h30m
  MEDIUM: [
    { offsetSeconds: 3600, label: '1h reminder' },
    { offsetSeconds: 10800, label: '3h reminder' },
    { offsetSeconds: 19800, label: '5h30m reminder' },
  ],
  // 24h ping: remind at 2h, 8h, 20h, 23h
  LONG: [
    { offsetSeconds: 7200, label: '2h reminder' },
    { offsetSeconds: 28800, label: '8h reminder' },
    { offsetSeconds: 72000, label: '20h reminder' },
    { offsetSeconds: 82800, label: '23h reminder' },
  ],
};

// Helper to get TTL preset from ttlSeconds
export function getTtlPreset(ttlSeconds: number): 'SHORT' | 'MEDIUM' | 'LONG' {
  if (ttlSeconds <= 3600) return 'SHORT';
  if (ttlSeconds <= 21600) return 'MEDIUM';
  return 'LONG';
}
