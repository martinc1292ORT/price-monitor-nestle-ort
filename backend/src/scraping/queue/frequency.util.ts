const PRESETS: Record<string, string> = {
  '1h': '0 * * * *',
  '3h': '0 */3 * * *',
  '6h': '0 */6 * * *',
  '12h': '0 */12 * * *',
  '24h': '0 0 * * *',
};

export function frequencyToCron(frequency: string): string {
  const preset = PRESETS[frequency.trim().toLowerCase()];
  if (preset) return preset;
  // assume already a cron expression
  return frequency.trim();
}
