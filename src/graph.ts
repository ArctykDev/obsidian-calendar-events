import { requestUrl } from "obsidian";
import { rrulestr } from "rrule";
import type { CalendarEvent, ObsidianCalendarSettings } from "./types";
import { normalizeTZID } from "./utils/tzidMap";

/**
 * Internal extension of CalendarEvent with calendar metadata.
 */
interface CalendarEventWithCalendar extends CalendarEvent {
  calendarId?: string;
  calendarName?: string;
  color?: string;
}

/**
 * Parses property lines like:
 *   DTSTART;TZID=America/New_York:20251105T120000
 *   DTSTART;VALUE=DATE:20251105
 */
function readProp(line: string): { value: string; tz?: string } {
  const [left, right] = line.split(":");
  const value = (right ?? "").trim();
  const m = left.match(/TZID=([^;]+)/i);
  const tz = normalizeTZID(m ? m[1].trim() : undefined);
  return { value, tz };
}

/**
 * Converts a wall time string with optional TZID to a UTC ISO string.
 *
 * Handles:
 * - DATE (no time) → midnight UTC
 * - Floating local time (no TZID, no Z)
 * - TZID-based local time (America/Toronto, Etc/UTC, "Eastern Standard Time", …)
 */
function zonedWallTimeToUTCISO(dateStr: string, tz?: string): string | null {
  if (!dateStr) return null;

  const m = dateStr.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh = "00", mm = "00", ss = "00"] = m;
  const year = +y,
    month = +mo,
    day = +d,
    hour = +hh,
    minute = +mm,
    second = +ss;

  // All-day events (VALUE=DATE)
  if (!dateStr.includes("T")) {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString();
  }

  // Floating times (no TZID, no Z) – assume local machine timezone
  if (!tz) {
    const local = new Date(year, month - 1, day, hour, minute, second);
    return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
  }

  // TZID-based time — compute intended UTC using Intl
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    // Take a "naive" UTC date with the same wall components,
    // then ask what clock time that corresponds to in the target zone.
    const probe = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const parts = dtf.formatToParts(probe);
    const obj: Record<string, string> = {};
    for (const p of parts) obj[p.type] = p.value;

    const tzWallUTC = Date.UTC(
      +obj.year,
      +obj.month - 1,
      +obj.day,
      +obj.hour,
      +obj.minute,
      +obj.second
    );
    const naiveUTC = Date.UTC(year, month - 1, day, hour, minute, second);
    const offsetMs = tzWallUTC - naiveUTC;

    const intendedUTC = naiveUTC - offsetMs;
    return new Date(intendedUTC).toISOString();
  } catch {
    // Fallback: assume the wall time is already UTC
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
  }
}

/**
 * Converts a date/time value and optional TZID to an ISO UTC string.
 */
function toISO(val: string, tz?: string): string | null {
  if (!val) return null;
  try {
    // VALUE=DATE (YYYYMMDD)
    if (/^\d{8}$/.test(val)) {
      const y = val.slice(0, 4);
      const m = val.slice(4, 6);
      const d = val.slice(6, 8);
      return new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
    }

    // Already UTC
    if (val.endsWith("Z")) return new Date(val).toISOString();

    // TZID / floating local
    return zonedWallTimeToUTCISO(val, tz);
  } catch {
    return null;
  }
}

/**
 * Full-featured ICS parser with:
 * - TZID support
 * - RRULE recurrence expansion
 * - RECURRENCE-ID cancellations AND modifications
 *
 * Recurrence expansion is constrained to [startBoundary, endBoundary] for performance.
 */
function parseICS(
  icsText: string,
  startBoundary: Date,
  endBoundary: Date
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);

  const recurringMasters: Record<string, any> = {};
  const cancelledInstances: Record<string, string[]> = {};
  const overrideInstances: Record<string, Record<string, CalendarEvent>> = {};

  for (const block of blocks) {
    const endBlock = block.split("END:VEVENT")[0];
    const lines = endBlock
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let uid = "";
    let summary = "(no title)";
    let start = "",
      startTz = "";
    let end = "",
      endTz = "";
    let recurrenceId = "",
      recurrenceTz = "";
    let rrule = "";
    let location = "";
    let canceled = false;

    for (const line of lines) {
      if (line.startsWith("UID:")) uid = line.substring(4).trim();
      else if (line.startsWith("SUMMARY"))
        summary = line.split(":").slice(1).join(":").trim();
      else if (line.startsWith("LOCATION"))
        location = line.split(":").slice(1).join(":").trim();
      else if (line.startsWith("STATUS:CANCELLED")) canceled = true;
      else if (line.startsWith("DTSTART")) {
        const { value, tz } = readProp(line);
        start = value;
        startTz = tz || "";
      } else if (line.startsWith("DTEND")) {
        const { value, tz } = readProp(line);
        end = value;
        endTz = tz || "";
      } else if (line.startsWith("RRULE:")) rrule = line.substring(6).trim();
      else if (line.startsWith("RECURRENCE-ID")) {
        const { value, tz } = readProp(line);
        recurrenceId = value;
        recurrenceTz = tz || "";
      }
    }

    const startISO = toISO(start, startTz || undefined);
    const endISO = toISO(end, endTz || undefined);

    if (!uid || !startISO) continue;

    // Master recurring event
    if (rrule && !recurrenceId) {
      recurringMasters[uid] = {
        uid,
        summary,
        location,
        startISO,
        endISO,
        rrule,
        startRaw: start,
        startTz,
      };
      continue;
    }

    // Recurring instance with RECURRENCE-ID
    if (recurrenceId) {
      const ridISO = toISO(recurrenceId, recurrenceTz || undefined);
      if (!ridISO) continue;

      // Cancelled occurrence
      if (canceled) {
        cancelledInstances[uid] = cancelledInstances[uid] || [];
        cancelledInstances[uid].push(ridISO);
        continue;
      }

      // Modified occurrence (time/location changed but not cancelled)
      const override: CalendarEvent = {
        id: uid + ridISO,
        subject: summary,
        start: startISO,
        end: endISO || startISO,
        location,
        isRecurring: true,
        raw: block,
      };

      if (!overrideInstances[uid]) overrideInstances[uid] = {};
      overrideInstances[uid][ridISO] = override;
      continue;
    }

    // Simple non-recurring event
    if (!canceled && !rrule && !recurrenceId) {
      events.push({
        id: uid + startISO,
        subject: summary,
        start: startISO,
        end: endISO || startISO,
        isRecurring: false,
        location,
        raw: block,
      });
    }
  }

  // Expand recurrence rules, constrained to [startBoundary, endBoundary]
  for (const uid in recurringMasters) {
    const m = recurringMasters[uid];

    // Build RRULE with its DTSTART derived from normalized startISO
    const dtStart = m.startISO.replace(/[-:]/g, "").split(".")[0] + "Z";
    const rule = rrulestr(`DTSTART:${dtStart}\nRRULE:${m.rrule}`);
    const between = rule.between(startBoundary, endBoundary, true);

    const durationMs =
      new Date(m.endISO ?? m.startISO).getTime() - new Date(m.startISO).getTime();

    for (const date of between) {
      const startDateISO = date.toISOString();
      const endDateISO = new Date(date.getTime() + durationMs).toISOString();

      // Canceled occurrences
      if (cancelledInstances[uid]?.includes(startDateISO)) {
        continue;
      }

      // Modified overrides: use the override's definition instead of master
      const overrideMap = overrideInstances[uid];
      if (overrideMap && overrideMap[startDateISO]) {
        events.push(overrideMap[startDateISO]);
        continue;
      }

      // Normal instance from master
      events.push({
        id: uid + startDateISO,
        subject: m.summary,
        start: startDateISO,
        end: endDateISO,
        location: m.location,
        isRecurring: true,
        raw: m,
      });
    }
  }

  return events.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Client for fetching and parsing multiple iCal feeds.
 */
export class CalendarClient {
  constructor(private settings: ObsidianCalendarSettings) { }

  async fetchEvents(): Promise<CalendarEvent[]> {
    const sources =
      (this.settings as any).calendars?.filter(
        (c: any) => c.enabled && c.url && c.url.trim()
      ) ?? [];

    if (!sources.length) {
      throw new Error("No enabled calendars configured.");
    }

    try {
      // ---- Date range normalization (LOCAL midnight-safe, full-day inclusive) ----
      const now = new Date();

      // Start of today in local time
      const startLocal = new Date(now);
      startLocal.setHours(0, 0, 0, 0);

      const daysBefore = this.settings.daysBefore ?? 0;
      const daysAhead = this.settings.daysAhead ?? 7;

      const startBoundary = new Date(
        startLocal.getTime() - daysBefore * 24 * 3600 * 1000
      );
      const endBoundary = new Date(
        startLocal.getTime() + daysAhead * 24 * 3600 * 1000
      );
      endBoundary.setHours(23, 59, 59, 999);

      // Add buffer hours to include early/late events near boundaries
      const bufferHours = 12;
      const startISO = new Date(
        startBoundary.getTime() - bufferHours * 3600 * 1000
      ).toISOString();
      const endISO = new Date(
        endBoundary.getTime() + bufferHours * 3600 * 1000
      ).toISOString();

      const startBoundaryUTC = new Date(startISO).getTime();
      const endBoundaryUTC = new Date(endISO).getTime();

      // ---- Fetch and parse all calendars ----
      const allResults = await Promise.all(
        sources.map(async (src: any) => {
          const response = await requestUrl({ url: src.url });
          const icsText = response.text || "";

          if (!icsText.includes("BEGIN:VEVENT")) {
            return [] as CalendarEventWithCalendar[];
          }

          const rawEvents = parseICS(icsText, startBoundary, endBoundary);

          const withMeta: CalendarEventWithCalendar[] = rawEvents.map((e) => ({
            ...e,
            calendarId: src.id,
            calendarName: src.name,
            color: src.color || "#4A90E2",
          }));

          return withMeta;
        })
      );

      const allEvents: CalendarEventWithCalendar[] = allResults.flat();

      // ---- Normalize and filter events to visible window ----
      const filtered = allEvents.filter((ev) => {
        let start = new Date(ev.start);
        let end = new Date(ev.end || ev.start);

        // Adjust for local (floating) times without "Z"
        if (!ev.start.endsWith("Z")) {
          const offset = start.getTimezoneOffset() * 60000;
          start = new Date(start.getTime() - offset);
          end = new Date(end.getTime() - offset);
        }

        // Detect possible all-day (midnight-to-midnight) events
        const isAllDay = /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(ev.start);

        // RFC 5545: DTEND for all-day events is exclusive → subtract one day
        if (isAllDay && end.getTime() > start.getTime()) {
          end = new Date(end.getTime() - 24 * 3600 * 1000);
        }

        const startTime = start.getTime();
        const endTime = end.getTime();

        // Include any event overlapping the visible window
        const include =
          (startTime >= startBoundaryUTC && startTime <= endBoundaryUTC) || // starts in range
          (endTime >= startBoundaryUTC && endTime <= endBoundaryUTC) || // ends in range
          (startTime <= startBoundaryUTC && endTime >= endBoundaryUTC); // spans entire range

        return include;
      });

      console.log("[OCE] Filtered events:", filtered.length);
      // Sort by start time
      return filtered.sort((a, b) => a.start.localeCompare(b.start));
    } catch (error: any) {
      console.error("Error fetching or parsing iCal feeds:", error);
      throw new Error(`Unable to load iCal feeds: ${error.message || error}`);
    }
  }
}
