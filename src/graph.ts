import { requestUrl } from "obsidian";
import { RRule, RRuleSet, rrulestr } from "rrule";
import type { CalendarEvent, ObsidianCalendarSettings } from "./types";


/**
 * Full-featured Outlook-compatible ICS parser.
 * Handles recurrence rules, cancellations, time zones, and folded lines.
 */
function parseICS(icsText: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);

  // Temporary maps for recurrence management
  const recurringMasters: Record<string, any> = {};
  const cancelledInstances: Record<string, string[]> = {};

  for (const block of blocks) {
    const endBlock = block.split("END:VEVENT")[0];
    const lines = endBlock.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    let uid = "";
    let summary = "(no title)";
    let start = "";
    let end = "";
    let rrule = "";
    let recurrenceId = "";
    let location = "";
    let canceled = false;

    for (const line of lines) {
      if (line.startsWith("UID:")) uid = line.substring(4).trim();
      else if (line.startsWith("SUMMARY")) summary = line.split(":").slice(1).join(":").trim();
      else if (line.startsWith("LOCATION")) location = line.split(":").slice(1).join(":").trim();
      else if (line.startsWith("STATUS:CANCELLED")) canceled = true;
      else if (line.startsWith("DTSTART")) start = line.split(":").slice(-1)[0].trim();
      else if (line.startsWith("DTEND")) end = line.split(":").slice(-1)[0].trim();
      else if (line.startsWith("RRULE:")) rrule = line.substring(6).trim();
      else if (line.startsWith("RECURRENCE-ID")) recurrenceId = line.split(":").slice(-1)[0].trim();
    }

    const toISO = (val: string): string | null => {
      if (!val) return null;
      try {
        if (/^\d{8}$/.test(val)) {
          const y = val.slice(0, 4);
          const m = val.slice(4, 6);
          const d = val.slice(6, 8);
          return new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
        }
        if (val.endsWith("Z")) return new Date(val).toISOString();

        const match = val.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})?$/);
        if (match) {
          const [, y, m, d, hh, mm, ss] = match;
          const local = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss || "00"}`);
          const utc = new Date(local.getTime() - local.getTimezoneOffset() * 60000);
          return utc.toISOString();
        }
        return null;
      } catch {
        return null;
      }
    };

    const startISO = toISO(start);
    const endISO = toISO(end);

    if (!uid || !startISO) continue;

    if (rrule) {
      recurringMasters[uid] = { uid, summary, location, startISO, endISO, rrule };
    } else if (recurrenceId && canceled) {
      cancelledInstances[uid] = cancelledInstances[uid] || [];
      cancelledInstances[uid].push(toISO(recurrenceId)!);
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

      // Skip canceled instances
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
 * Client for fetching and parsing calendar events from an iCal feed.
 */
export class CalendarClient {
  constructor(private settings: ObsidianCalendarSettings) {}

  /**
 * Fetches and parses events from the configured iCal URL.
 * Filters results based on the user's configured date range.
 */
async fetchEvents(): Promise<CalendarEvent[]> {
  if (!this.settings.icalUrl || !this.settings.icalUrl.trim()) {
    throw new Error("No iCal URL configured. Please set one in plugin settings.");
  }

  try {
    const response = await requestUrl({ url: this.settings.icalUrl });
    const icsText = response.text || "";

    if (!icsText.includes("BEGIN:VEVENT")) {
      throw new Error("Invalid or empty iCal feed.");
    }

    const allEvents = parseICS(icsText);

    // ---- Date range normalization (LOCAL midnight-safe, full-day inclusive) ----
    const now = new Date();
    
    // Start of today in local time
    const startLocal = new Date(now);
    startLocal.setHours(0, 0, 0, 0);
    
    // Apply configured date window
    const startBoundary = new Date(
      startLocal.getTime() - (this.settings.daysBefore ?? 0) * 24 * 3600 * 1000
    );
    const endBoundary = new Date(
      startLocal.getTime() + (this.settings.daysAhead ?? 7) * 24 * 3600 * 1000
    );
    
    // Extend endBoundary to end of day (23:59:59 local)
    endBoundary.setHours(23, 59, 59, 999);
    
    // Add buffer hours to include early/late events near boundaries
    const bufferHours = 12;
    const startISO = new Date(startBoundary.getTime() - bufferHours * 3600 * 1000).toISOString();
    const endISO = new Date(endBoundary.getTime() + bufferHours * 3600 * 1000).toISOString();
    
    // Diagnostics
    console.log("🧭 [Calendar Diagnostics]");
    console.log("Now:", now.toISOString());
    console.log("Start boundary (LOCAL midnight):", startISO);
    console.log("End boundary (LOCAL end of day):", endISO);
    

    console.log(
      "Sample events:",
      allEvents.slice(0, 5).map((e) => ({
        subject: e.subject,
        start: e.start,
        end: e.end,
        hasZ: e.start.endsWith("Z"),
      }))
    );

    // ---- Normalize and filter events ----
    const startBoundaryUTC = new Date(startISO).getTime();
    const endBoundaryUTC = new Date(endISO).getTime();
    
    const filteredEvents = allEvents.filter((ev) => {
      const start = new Date(ev.start);
      let end = new Date(ev.end || ev.start);
    
      // Adjust for local (floating) times without "Z"
      if (!ev.start.endsWith("Z")) {
        const offset = start.getTimezoneOffset() * 60000;
        start.setTime(start.getTime() - offset);
        end.setTime(end.getTime() - offset);
      }
    
      // Detect possible all-day (midnight-to-midnight) events
      const isAllDay = /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(ev.start);
    
      // RFC 5545: DTEND for all-day events is exclusive → subtract one day
      if (isAllDay && end.getTime() > start.getTime()) {
        end = new Date(end.getTime() - 24 * 3600 * 1000);
      }
    
      // Convert to timestamps for numeric comparison
      const startTime = start.getTime();
      const endTime = end.getTime();
    
      // Include any event overlapping the visible window
      const include =
        (startTime >= startBoundaryUTC && startTime <= endBoundaryUTC) || // starts in range
        (endTime >= startBoundaryUTC && endTime <= endBoundaryUTC) ||     // ends in range
        (startTime <= startBoundaryUTC && endTime >= endBoundaryUTC);     // spans entire range
    
      if (!include) {
        console.debug("⏭️ Skipped event:", {
          subject: ev.subject,
          start: ev.start,
          end: ev.end,
          reason: "Outside visible range after normalization",
        });
      }
    
      return include;
    });
    
    console.log("✅ Filtered events after overlap logic:", filteredEvents.length); 
    

    return filteredEvents.sort((a, b) => a.start.localeCompare(b.start));
  } catch (error: any) {
    console.error("❌ Error fetching or parsing iCal feed:", error);
    throw new Error(`Unable to load iCal feed: ${error.message || error}`);
  }
}
}  