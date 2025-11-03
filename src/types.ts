/**
 * Plugin settings structure for Obsidian Calendar Events.
 * Supports multiple ICS calendar feeds (no authentication dependencies).
 */

export interface CalendarSource {
  id: string;
  name: string;
  url: string;
  color?: string;
  enabled: boolean;
}

export interface ObsidianCalendarSettings {
  // Calendar sources
  calendars: CalendarSource[];

  // Range of days to include before and after today
  daysBefore: number;
  daysAhead: number;

  // Sort order of events in the view
  sortOrder: "asc" | "desc";

  // Always show today's events at the top
  pinToday: boolean;

  // Add events under a specific heading in the daily note
  addUnderHeading: boolean;

  // The heading name under which events are added
  headingName: string;

  firstRun?: boolean;

  // Persisted map of calendar visibility states
  visibleCalendars?: Record<string, boolean>;
}

/**
 * Calendar event structure parsed from an iCal feed.
 * Includes metadata linking it to a specific calendar source.
 */
export interface CalendarEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  location?: string;
  raw?: any;

  // Added for multi-calendar support
  calendarId?: string;
  calendarName?: string;
  color?: string;
}
