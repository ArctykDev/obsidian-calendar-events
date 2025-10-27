import { requestUrl } from "obsidian";
import type { CalendarEvent, ObsidianCalendarSettings } from "./types";

/**
 * Lightweight iCal (ICS) parser.
 * Extracts VEVENT blocks and converts them into structured event objects.
 */
function parseICS(icsText: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const blocks = icsText.split("BEGIN:VEVENT").slice(1);

  for (const block of blocks) {
    const endBlock = block.split("END:VEVENT")[0];
    const lines = endBlock.split(/\r?\n/).map((l) => l.trim());

    let uid = "";
    let summary = "(no title)";
    let start = "";
    let end = "";
    let location = "";

    for (const line of lines) {
      if (line.startsWith("UID:")) uid = line.substring(4).trim();
      else if (line.startsWith("SUMMARY:")) summary = line.substring(8).trim();
      else if (line.startsWith("DTSTART")) start = line.split(":")[1]?.trim();
      else if (line.startsWith("DTEND")) end = line.split(":")[1]?.trim();
      else if (line.startsWith("LOCATION:")) location = line.substring(9).trim();
    }

    const toISO = (val: string): string | null => {
      if (!val) return null;
      try {
        // UTC (Z) or local format
        if (val.endsWith("Z")) {
          return new Date(val).toISOString();
        }
        const match = val.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})?$/);
        if (match) {
          const [, y, m, d, hh, mm, ss] = match;
          return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss || "00"}`).toISOString();
        }
        return null;
      } catch {
        return null;
      }
    };

    const startISO = toISO(start);
    const endISO = toISO(end);

    if (startISO) {
      events.push({
        id: uid || Math.random().toString(36).slice(2),
        subject: summary,
        start: startISO,
        end: endISO || startISO,
        location,
        raw: block,
      });
    }
  }

  // Sort chronologically by start date
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

      const events = parseICS(icsText);

      // Filter by date range
      const now = new Date();
      const startBoundary = new Date(now);
      startBoundary.setDate(startBoundary.getDate() - (this.settings.daysBefore ?? 0));

      const endBoundary = new Date(now);
      endBoundary.setDate(endBoundary.getDate() + (this.settings.daysAhead ?? 7));

      return events.filter((ev) => {
        const startDate = new Date(ev.start);
        return startDate >= startBoundary && startDate <= endBoundary;
      });
    } catch (error: any) {
      console.error("Error fetching or parsing iCal feed:", error);
      throw new Error(`Unable to load iCal feed: ${error.message || error}`);
    }
  }
}
