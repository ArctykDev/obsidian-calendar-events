import { requestUrl } from "obsidian";
import { rrulestr } from "rrule";
import type { CalendarEvent, ObsidianCalendarSettings } from "./types";
import { normalizeTZID } from "./utils/tzidMap"; 

/**
 * Parses property lines like DTSTART;TZID=America/New_York:20251105T120000
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
 */
function zonedWallTimeToUTCISO(dateStr: string, tz?: string): string | null {
  if (!dateStr) return null;

  const m = dateStr.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh = "00", mm = "00", ss = "00"] = m;
  const year = +y, month = +mo, day = +d, hour = +hh, minute = +mm, second = +ss;

  // All-day events (VALUE=DATE)
  if (!dateStr.includes("T")) {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString();
  }

  // If already UTC (Z suffix handled elsewhere), this won't be used
  if (!tz) {
    const local = new Date(year, month - 1, day, hour, minute, second);
    return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
  }

  // Compute timezone offset using Intl.DateTimeFormat
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(new Date(Date.UTC(year, month - 1, day, hour, minute, second)));
    const obj: any = {};
    for (const p of parts) obj[p.type] = p.value;
    const tzWallUTC = Date.UTC(+obj.year, +obj.month - 1, +obj.day, +obj.hour, +obj.minute, +obj.second);
    const naiveUTC = Date.UTC(year, month - 1, day, hour, minute, second);
    const offsetMs = tzWallUTC - naiveUTC;
    const intendedUTC = naiveUTC - offsetMs;
    return new Date(intendedUTC).toISOString();
  } catch {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
  }
}

/**
 * Converts a date/time value and optional TZID to an ISO UTC string.
 */
function toISO(val: string, tz?: string): string | null {
  if (!val) return null;
  try {
    if (/^\d{8}$/.test(val)) {
      // VALUE=DATE
      const y = val.slice(0, 4);
      const m = val.slice(4, 6);
      const d = val.slice(6, 8);
      return new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
    }
    if (val.endsWith("Z")) return new Date(val).toISOString();
    return zonedWallTimeToUTCISO(val, tz);
  } catch {
    return null;
  }
}

/**
 * Full-featured Outlook-compatible ICS parser.
 * Handles recurrence rules, cancellations, time zones, and folded lines.
 */
function parseICS(icsText: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);

  const recurringMasters: Record<string, any> = {};
  const cancelledInstances: Record<string, string[]> = {};

  for (const block of blocks) {
    const endBlock = block.split("END:VEVENT")[0];
    const lines = endBlock.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    let uid = "";
    let summary = "(no title)";
    let start = "", startTz = "";
    let end = "", endTz = "";
    let recurrenceId = "", recurrenceTz = "";
    let rrule = "";
    let location = "";
    let canceled = false;

    for (const line of lines) {
      if (line.startsWith("UID:")) uid = line.substring(4).trim();
      else if (line.startsWith("SUMMARY")) summary = line.split(":").slice(1).join(":").trim();
      else if (line.startsWith("LOCATION")) location = line.split(":").slice(1).join(":").trim();
      else if (line.startsWith("STATUS:CANCELLED")) canceled = true;
      else if (line.startsWith("DTSTART")) {
        const { value, tz } = readProp(line);
        start = value; startTz = tz || "";
      }
      else if (line.startsWith("DTEND")) {
        const { value, tz } = readProp(line);
        end = value; endTz = tz || "";
      }
      else if (line.startsWith("RRULE:")) rrule = line.substring(6).trim();
      else if (line.startsWith("RECURRENCE-ID")) {
        const { value, tz } = readProp(line);
        recurrenceId = value; recurrenceTz = tz || "";
      }
    }

    const startISO = toISO(start, startTz || undefined);
    const endISO = toISO(end, endTz || undefined);

    if (!uid || !startISO) continue;

    if (rrule) {
      recurringMasters[uid] = { uid, summary, location, startISO, endISO, rrule };
    } else if (recurrenceId && canceled) {
      cancelledInstances[uid] = cancelledInstances[uid] || [];
      const ridISO = toISO(recurrenceId, recurrenceTz || undefined);
      if (ridISO) cancelledInstances[uid].push(ridISO);
    } else if (!canceled) {
      events.push({
        id: uid + startISO,
        subject: summary,
        start: startISO,
        end: endISO || startISO,
        location,
        raw: block,
      });
    }
  }

  // Expand recurrence rules
  for (const uid in recurringMasters) {
    const m = recurringMasters[uid];
    const rule = rrulestr(`DTSTART:${m.startISO.replace(/[-:]/g, "").split(".")[0]}Z\nRRULE:${m.rrule}`);
    const between = rule.between(new Date("2025-01-01"), new Date("2026-01-01"), true);

    for (const date of between) {
      const startDate = date.toISOString();
      const duration = new Date(m.endISO).getTime() - new Date(m.startISO).getTime();
      const endDate = new Date(new Date(startDate).getTime() + duration).toISOString();
      if (cancelledInstances[uid]?.includes(startDate)) continue;

      events.push({
        id: uid + startDate,
        subject: m.summary,
        start: startDate,
        end: endDate,
        location: m.location,
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
  constructor(private settings: ObsidianCalendarSettings) {}

  async fetchEvents(): Promise<CalendarEvent[]> {
    const sources = (this.settings.calendars || []).filter((c) => c.enabled && c.url.trim());
    if (sources.length === 0) {
      throw new Error("No enabled calendars configured.");
    }

    try {
      const allResults = await Promise.all(
        sources.map(async (src) => {
          const response = await requestUrl({ url: src.url });
          const events = parseICS(response.text);
          return events.map((e) => ({
            ...e,
            calendarId: src.id,
            calendarName: src.name,
            color: src.color || "#4A90E2",
          }));
        })
      );

      const allEvents = allResults.flat();

      // --- Date Range Filtering ---
      const now = new Date();
      const startLocal = new Date(now);
      startLocal.setHours(0, 0, 0, 0);

      const startBoundary = new Date(
        startLocal.getTime() - (this.settings.daysBefore ?? 0) * 24 * 3600 * 1000
      );
      const endBoundary = new Date(
        startLocal.getTime() + (this.settings.daysAhead ?? 7) * 24 * 3600 * 1000
      );
      endBoundary.setHours(23, 59, 59, 999);

      const bufferHours = 12;
      const startISO = new Date(startBoundary.getTime() - bufferHours * 3600 * 1000).toISOString();
      const endISO = new Date(endBoundary.getTime() + bufferHours * 3600 * 1000).toISOString();

      const startBoundaryUTC = new Date(startISO).getTime();
      const endBoundaryUTC = new Date(endISO).getTime();

      const filtered = allEvents.filter((ev) => {
        const start = new Date(ev.start).getTime();
        const end = new Date(ev.end || ev.start).getTime();
        return (
          (start >= startBoundaryUTC && start <= endBoundaryUTC) ||
          (end >= startBoundaryUTC && end <= endBoundaryUTC) ||
          (start <= startBoundaryUTC && end >= endBoundaryUTC)
        );
      });

      console.log("Filtered events:", filtered.length);
      return filtered.sort((a, b) => a.start.localeCompare(b.start));
    } catch (error: any) {
      console.error("Error fetching or parsing iCal feeds:", error);
      throw new Error(`Unable to load iCal feeds: ${error.message || error}`);
    }
  }
}
