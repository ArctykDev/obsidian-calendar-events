import { requestUrl } from "obsidian";
import { rrulestr } from "rrule";
import type { CalendarEvent, CalendarSource, ObsidianCalendarSettings } from "./types";
import { normalizeTZID } from "./utils/tzidMap";

/**
 * Parses property lines like:
 *   DTSTART;TZID=America/New_York:20251105T120000
 *   DTSTART;VALUE=DATE:20251105
 */
function readProp(line: string): { value: string; tz?: string } {
  const colonIdx = line.indexOf(":");
  const left = colonIdx === -1 ? line : line.slice(0, colonIdx);
  const value = colonIdx === -1 ? "" : line.slice(colonIdx + 1).trim();
  const m = left.match(/TZID=([^;]+)/i);
  // Strip surrounding quotes that some servers emit: TZID="America/New_York"
  const rawTz = m ? m[1].trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "") : undefined;
  const tz = normalizeTZID(rawTz);
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

  // Floating times (no TZID, no Z) – treat as local machine timezone.
  // new Date(y, m, d, h, min, s) creates a local-time Date; .toISOString()
  // converts it to the correct UTC equivalent.
  if (!tz) {
    return new Date(year, month - 1, day, hour, minute, second).toISOString();
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

    let intendedUTC = naiveUTC - offsetMs;

    // DST guard: the probe UTC time may straddle a DST transition boundary,
    // so the offset it observes might belong to the wrong DST regime.
    // Example: on US spring-forward day (Mar 8 2026), an event at 3 AM EDT
    // has probe=03:00 UTC (still EST, −5h) → first guess = 08:00 UTC (wrong).
    // Re-evaluating the offset AT the candidate time corrects it to 07:00 UTC.
    // One iteration is sufficient for all real-world ±1h DST transitions.
    const verifyParts = dtf.formatToParts(new Date(intendedUTC));
    const v: Record<string, string> = {};
    for (const p of verifyParts) v[p.type] = p.value;
    const verifyWallUTC = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute, +v.second);
    const verifyOffsetMs = verifyWallUTC - intendedUTC;
    if (verifyOffsetMs !== offsetMs) {
      intendedUTC = naiveUTC - verifyOffsetMs;
    }

    return new Date(intendedUTC).toISOString();
  } catch {
    // Fallback: assume the wall time is already UTC.
    // This fires when `tz` is not a valid IANA identifier — log so it can be
    // added to the normalizeTZID map if needed.
    console.warn(`[OCE] Unrecognised timezone "${tz}" — treating as UTC. Event time may be incorrect.`);
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

    // Already UTC (with Z suffix) - must parse compact format first
    // Google Calendar often uses: 20260124T150000Z
    if (val.endsWith("Z")) {
      const stripped = val.slice(0, -1); // Remove 'Z'
      const utcISO = zonedWallTimeToUTCISO(stripped, "UTC");
      return utcISO;
    }

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

  console.log(`[OCE] Parsing ${blocks.length} VEVENT blocks`);

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

    if (!uid || !startISO) {
      console.warn(`[OCE] Skipping event - uid: ${!!uid}, startISO: ${!!startISO}, start: ${start}`);
      continue;
    }

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
        endRaw: end,
        endTz,
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

    // Three cases for DTSTART handling:
    //
    // 1. TZID events (America/New_York etc.)
    //    Use the raw wall-clock string as a FLOATING DTSTART so rrule
    //    preserves the wall-clock hour across DST transitions. Then re-convert
    //    each occurrence back to UTC using the original TZID.
    //    If we used UTC Z-time instead, rrule would repeat the same UTC instant
    //    every week — correct in winter, but 1h off after spring-forward.
    //
    // 2. UTC events (DTSTART:...Z — no TZID, explicit Z)
    //    UTC has no DST, so the original UTC-based approach is correct.
    //    date.toISOString() works directly.
    //
    // 3. Floating events (no TZID, no Z)
    //    Use the raw wall-clock string as DTSTART, re-convert each occurrence
    //    as local machine time.

    const isUTC = m.startRaw.endsWith("Z");
    const hasTzid = !!(m.startTz);

    let rule;
    if (isUTC) {
      // Case 2: keep UTC DTSTART — no DST consideration needed
      const dtStartUTC = m.startISO.replace(/[-:]/g, "").split(".")[0] + "Z";
      rule = rrulestr(`DTSTART:${dtStartUTC}\nRRULE:${m.rrule}`);
    } else {
      // Cases 1 & 3: floating DTSTART using original wall-clock digits
      rule = rrulestr(`DTSTART:${m.startRaw}\nRRULE:${m.rrule}`);
    }

    const between = rule.between(startBoundary, endBoundary, true);

    // Duration in ms — computed from UTC ISO strings, so timezone-independent.
    const durationMs =
      new Date(m.endISO ?? m.startISO).getTime() - new Date(m.startISO).getTime();

    for (const date of between) {
      let startDateISO: string;

      if (isUTC) {
        // Case 2: date is already a proper UTC instant
        startDateISO = date.toISOString();
      } else if (hasTzid) {
        // Case 1: rrule floating-mode stores wall-clock digits in UTC fields.
        // Rebuild the wall-clock string and convert with the original TZID.
        const wallStr =
          String(date.getUTCFullYear()).padStart(4, "0") +
          String(date.getUTCMonth() + 1).padStart(2, "0") +
          String(date.getUTCDate()).padStart(2, "0") +
          "T" +
          String(date.getUTCHours()).padStart(2, "0") +
          String(date.getUTCMinutes()).padStart(2, "0") +
          String(date.getUTCSeconds()).padStart(2, "0");
        startDateISO = zonedWallTimeToUTCISO(wallStr, m.startTz) ?? date.toISOString();
      } else {
        // Case 3: floating — treat UTC fields as local wall-clock time
        startDateISO = new Date(
          date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
          date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()
        ).toISOString();
      }

      const endDateISO = new Date(
        new Date(startDateISO).getTime() + durationMs
      ).toISOString();

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
    const sources: CalendarSource[] =
      this.settings.calendars?.filter(
        (c) => c.enabled && c.url && c.url.trim()
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

      // Use setDate (not ms arithmetic) so DST transitions don't shift the
      // boundary by an hour and silently drop all-day events.
      const startBoundary = new Date(startLocal);
      startBoundary.setDate(startBoundary.getDate() - daysBefore);

      const endBoundary = new Date(startLocal);
      endBoundary.setDate(endBoundary.getDate() + daysAhead);
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
        sources.map(async (src) => {
          try {
            const response = await requestUrl({
              url: src.url,
              headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
              },
            });
            const icsText = response.text || "";

            if (!icsText.includes("BEGIN:VEVENT")) {
              console.warn(`[OCE] No VEVENT blocks found in calendar: ${src.name}`);
              return [] as CalendarEvent[];
            }

            const rawEvents = parseICS(icsText, startBoundary, endBoundary);
            console.log(`[OCE] Parsed ${rawEvents.length} events from ${src.name}`);

            return rawEvents.map((e) => ({
              ...e,
              calendarId: src.id,
              calendarName: src.name,
              color: src.color || "#4A90E2",
            })) as CalendarEvent[];
          } catch (err) {
            console.error(`[OCE] Failed to fetch calendar "${src.name}":`, err);
            return [] as CalendarEvent[];
          }
        })
      );

      const allEvents: CalendarEvent[] = allResults.flat();

      // ---- Normalize and filter events to visible window ----
      const filtered = allEvents.filter((ev) => {
        const start = new Date(ev.start);
        let end = new Date(ev.end || ev.start);

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
