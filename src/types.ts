/**
 * Plugin settings structure for Obsidian Calendar Events.
 * ICS-only version (no authentication, Outlook, or Microsoft Graph dependencies).
 */
export interface ObsidianCalendarSettings {
  // iCal URL to pull events from
  icalUrl: string;

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
}

/**
 * Basic calendar event structure parsed from the iCal feed.
 */
export interface CalendarEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  location?: string;
  raw?: any;
}
