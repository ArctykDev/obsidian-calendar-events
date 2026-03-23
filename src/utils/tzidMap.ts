/**
 * Maps Windows / Microsoft TZID strings to IANA time zone identifiers.
 * Covers all standard Windows timezone names (CLDR-based) plus common
 * Rails/Ruby shorthand names and UTC variants.
 *
 * For any TZID not found here the raw (cleaned) value is returned so that
 * valid IANA names (e.g. "America/Toronto") pass straight through to Intl.
 */

// Full Windows → IANA map derived from Unicode CLDR windowsZones.xml
const WINDOWS_TO_IANA: Record<string, string> = {
  // ── North America ────────────────────────────────────────────────────────
  "Dateline Standard Time":           "Etc/GMT+12",
  "UTC-11":                           "Etc/GMT+11",
  "Hawaiian Standard Time":           "Pacific/Honolulu",
  "Alaskan Standard Time":            "America/Anchorage",
  "Alaska Standard Time":             "America/Anchorage",
  "Pacific Standard Time":            "America/Los_Angeles",
  "Pacific Daylight Time":            "America/Los_Angeles",
  "Pacific Standard Time (Mexico)":   "America/Santa_Isabel",
  "US Mountain Standard Time":        "America/Phoenix",
  "Mountain Standard Time (Mexico)":  "America/Chihuahua",
  "Mountain Standard Time":           "America/Denver",
  "Mountain Daylight Time":           "America/Denver",
  "Central America Standard Time":    "America/Guatemala",
  "Central Standard Time":            "America/Chicago",
  "Central Daylight Time":            "America/Chicago",
  "Central Standard Time (Mexico)":   "America/Mexico_City",
  "Canada Central Standard Time":     "America/Regina",
  "SA Pacific Standard Time":         "America/Bogota",
  "Eastern Standard Time (Mexico)":   "America/Cancun",
  "Eastern Standard Time":            "America/New_York",
  "Eastern Daylight Time":            "America/New_York",
  "US Eastern Standard Time":         "America/Indianapolis",
  "Venezuela Standard Time":          "America/Caracas",
  "Paraguay Standard Time":           "America/Asuncion",
  "Atlantic Standard Time":           "America/Halifax",
  "Atlantic Daylight Time":           "America/Halifax",
  "Central Brazilian Standard Time":  "America/Cuiaba",
  "SA Western Standard Time":         "America/La_Paz",
  "Newfoundland Standard Time":       "America/St_Johns",
  "E. South America Standard Time":   "America/Sao_Paulo",
  "Brazil Standard Time":             "America/Sao_Paulo",
  "Argentina Standard Time":          "America/Argentina/Buenos_Aires",
  "SA Eastern Standard Time":         "America/Cayenne",
  "Greenland Standard Time":          "America/Godthab",
  "Montevideo Standard Time":         "America/Montevideo",
  "Bahia Standard Time":              "America/Bahia",
  "UTC-02":                           "Etc/GMT+2",
  "Mid-Atlantic Standard Time":       "Etc/GMT+2",
  "Azores Standard Time":             "Atlantic/Azores",
  "Cape Verde Standard Time":         "Atlantic/Cape_Verde",

  // ── UTC / GMT ────────────────────────────────────────────────────────────
  "UTC":                              "UTC",
  "Coordinated Universal Time":       "UTC",
  "GMT Standard Time":                "Europe/London",    // UK — handles BST
  "Greenwich Standard Time":          "Atlantic/Reykjavik",

  // ── Europe ───────────────────────────────────────────────────────────────
  "W. Europe Standard Time":          "Europe/Berlin",
  "Central European Standard Time":   "Europe/Warsaw",
  "Central Europe Standard Time":     "Europe/Budapest",
  "Romance Standard Time":            "Europe/Paris",
  "Morocco Standard Time":            "Africa/Casablanca",
  "FLE Standard Time":                "Europe/Helsinki",
  "GTB Standard Time":                "Europe/Bucharest",
  "Middle East Standard Time":        "Asia/Beirut",
  "Egypt Standard Time":              "Africa/Cairo",
  "Syria Standard Time":              "Asia/Damascus",
  "E. Europe Standard Time":          "Asia/Nicosia",
  "South Africa Standard Time":       "Africa/Johannesburg",
  "FLE Standard Time ":               "Europe/Helsinki",
  "Turkey Standard Time":             "Europe/Istanbul",
  "Israel Standard Time":             "Asia/Jerusalem",
  "Libya Standard Time":              "Africa/Tripoli",

  // ── Russia / Central Asia ────────────────────────────────────────────────
  "Jordan Standard Time":             "Asia/Amman",
  "Arabic Standard Time":             "Asia/Baghdad",
  "Kaliningrad Standard Time":        "Europe/Kaliningrad",
  "Arab Standard Time":               "Asia/Riyadh",
  "E. Africa Standard Time":          "Africa/Nairobi",
  "Iran Standard Time":               "Asia/Tehran",
  "Arabian Standard Time":            "Asia/Dubai",
  "Azerbaijan Standard Time":         "Asia/Baku",
  "Russian Standard Time":            "Europe/Moscow",
  "Mauritius Standard Time":          "Indian/Mauritius",
  "Georgian Standard Time":           "Asia/Tbilisi",
  "Caucasus Standard Time":           "Asia/Yerevan",
  "Afghanistan Standard Time":        "Asia/Kabul",
  "Pakistan Standard Time":           "Asia/Karachi",
  "West Asia Standard Time":          "Asia/Tashkent",
  "India Standard Time":              "Asia/Calcutta",
  "Sri Lanka Standard Time":          "Asia/Colombo",
  "Nepal Standard Time":              "Asia/Katmandu",
  "Central Asia Standard Time":       "Asia/Almaty",
  "Bangladesh Standard Time":         "Asia/Dhaka",
  "Ekaterinburg Standard Time":       "Asia/Yekaterinburg",
  "Myanmar Standard Time":            "Asia/Rangoon",
  "SE Asia Standard Time":            "Asia/Bangkok",
  "N. Central Asia Standard Time":    "Asia/Novosibirsk",
  "China Standard Time":              "Asia/Shanghai",
  "North Asia Standard Time":         "Asia/Krasnoyarsk",
  "Singapore Standard Time":          "Asia/Singapore",
  "W. Australia Standard Time":       "Australia/Perth",
  "Taipei Standard Time":             "Asia/Taipei",
  "Ulaanbaatar Standard Time":        "Asia/Ulaanbaatar",
  "North Asia East Standard Time":    "Asia/Irkutsk",
  "Japan Standard Time":              "Asia/Tokyo",
  "Tokyo Standard Time":              "Asia/Tokyo",
  "Korea Standard Time":              "Asia/Seoul",
  "Cen. Australia Standard Time":     "Australia/Adelaide",
  "AUS Central Standard Time":        "Australia/Darwin",
  "E. Australia Standard Time":       "Australia/Brisbane",
  "AUS Eastern Standard Time":        "Australia/Sydney",
  "West Pacific Standard Time":       "Pacific/Port_Moresby",
  "Tasmania Standard Time":           "Australia/Hobart",
  "Yakutsk Standard Time":            "Asia/Yakutsk",
  "Central Pacific Standard Time":    "Pacific/Guadalcanal",
  "Vladivostok Standard Time":        "Asia/Vladivostok",
  "New Zealand Standard Time":        "Pacific/Auckland",
  "UTC+12":                           "Etc/GMT-12",
  "Fiji Standard Time":               "Pacific/Fiji",
  "Magadan Standard Time":            "Asia/Magadan",
  "Kamchatka Standard Time":          "Asia/Kamchatka",
  "Tonga Standard Time":              "Pacific/Tongatapu",

  // ── Common alternate / shorthand names ──────────────────────────────────
  "Eastern Time":                     "America/New_York",
  "Eastern Time (US & Canada)":       "America/New_York",
  "Central Time (US & Canada)":       "America/Chicago",
  "Mountain Time (US & Canada)":      "America/Denver",
  "Pacific Time (US & Canada)":       "America/Los_Angeles",
  "Arizona":                          "America/Phoenix",
  "London":                           "Europe/London",
  "Paris":                            "Europe/Paris",
  "Berlin":                           "Europe/Berlin",
  "Moscow":                           "Europe/Moscow",
  "Beijing":                          "Asia/Shanghai",
};

export function normalizeTZID(tz?: string): string | undefined {
  if (!tz) return tz;

  // Strip surrounding quotes: TZID="America/New_York" → America/New_York
  const unquoted = tz.replace(/^"|"$|^'|'$/g, "").trim();

  // Strip common Windows display prefix: "(UTC-05:00) Eastern Time" → "Eastern Time"
  const cleaned = unquoted.replace(/^\(UTC[^)]*\)\s*/i, "").trim();

  return WINDOWS_TO_IANA[cleaned] ?? WINDOWS_TO_IANA[unquoted] ?? cleaned;
}
