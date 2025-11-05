/**
 * Maps common Windows / Microsoft TZIDs to IANA time zones.
 * Used by the calendar parser to ensure correct UTC conversion.
 */

export function normalizeTZID(tz?: string): string | undefined {
  if (!tz) return tz;

  const map: Record<string, string> = {
    "Eastern Standard Time": "America/New_York",
    "Central Standard Time": "America/Chicago",
    "Mountain Standard Time": "America/Denver",
    "Pacific Standard Time": "America/Los_Angeles",
    "Atlantic Standard Time": "America/Halifax",
    "Newfoundland Standard Time": "America/St_Johns",
    "Greenwich Standard Time": "Etc/Greenwich",
    "UTC": "UTC",
    "Coordinated Universal Time": "UTC",
    "Eastern Time": "America/New_York",
    "Eastern Time (US & Canada)": "America/New_York",
  };

  // Clean up things like "(UTC-05:00) Eastern Time (US & Canada)"
  const cleaned = tz.replace(/\(UTC[^\)]*\)\s*/i, "").trim();
  return map[cleaned] || tz;
}
