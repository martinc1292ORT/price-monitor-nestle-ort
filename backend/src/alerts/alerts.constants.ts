export const ALERT_STATUSES = [
  'open',
  'in_review',
  'resolved',
  'dismissed',
] as const;

export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;

export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];
