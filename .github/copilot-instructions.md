# Obsidian Calendar Events - AI Coding Agent Instructions

## Project Overview
This is an Obsidian plugin that fetches and displays iCal (.ics) calendar events inside Obsidian. Built with TypeScript using the Obsidian API, it supports multiple calendar feeds (Google, Outlook, SharePoint) with no authentication—only public ICS URLs.

**Key Architecture:**
- **Entry point:** [src/main.ts](../src/main.ts) - Plugin class (`ObsidianCalendarPlugin`) with lifecycle, commands, ribbon icon
- **Calendar client:** [src/graph.ts](../src/graph.ts) - `CalendarClient` handles iCal parsing, timezone normalization, recurring events (rrule), and multi-calendar fetching
- **View layer:** [src/ui/CalendarView.ts](../src/ui/CalendarView.ts) - Custom Obsidian `ItemView` for rendering event list with collapsible days, calendar filters, and daily note integration
- **Settings:** [src/settings.ts](../src/settings.ts) - Multi-calendar management UI with color pickers, enable/disable toggles

## Build & Development

**Build commands:**
```bash
npm run dev     # Watch mode with hot reload
npm run build   # Production build → outputs main.js to plugin root
npm run clean   # Remove build artifacts
```

**Build system:** Rollup bundles TypeScript → CommonJS (`main.js`). The [rollup.config.js](../rollup.config.js) copies `src/styles.css` to root during build. Output files (`main.js`, `manifest.json`, `styles.css`) must exist in vault's `.obsidian/plugins/obsidian-calendar-events/` to load.

**Testing:** Develop by building into an active vault's plugin folder. Reload Obsidian after changes (Ctrl+R in dev mode).

## Critical Patterns

### Multi-Calendar Architecture
- **Settings structure:** `ObsidianCalendarSettings.calendars: CalendarSource[]` where each source has `{id, name, url, color, enabled}`
- **Event metadata:** All `CalendarEvent` objects include `calendarId`, `calendarName`, `color` to link back to source
- **Visibility state:** Persisted in `settings.visibleCalendars: Record<string, boolean>` - allows hiding calendars without disabling them

### Timezone & Date Handling
- **Key module:** [src/utils/tzidMap.ts](../src/utils/tzidMap.ts) normalizes Windows TZID formats → IANA (e.g., "Eastern Standard Time" → "America/New_York")
- **Parser:** `graph.ts:zonedWallTimeToUTCISO()` converts iCal DTSTART/DTEND with TZID to UTC ISO strings using `Intl.DateTimeFormat`
- **All-day events:** DATE values (no time component) → midnight UTC
- **Floating times:** No TZID → assume local machine timezone
- Always work with ISO UTC strings internally; display formatting uses `moment`

### Recurring Events
- **Library:** `rrule` package parses RRULE property and generates occurrences
- **Expansion:** `graph.ts:expandRecurrences()` converts a single VEVENT with RRULE into multiple `CalendarEvent` instances within the configured date range
- **Date range:** Controlled by `settings.daysBefore` and `settings.daysAhead` (default: 0 days before, 7 ahead)

### Daily Note Integration
- **Dependency:** `obsidian-daily-notes-interface` package for `getDailyNote()`, `createDailyNote()`
- **Event insertion:** Clicking event in view adds markdown under optional heading (`settings.headingName`) in today's daily note
- **Command:** "Insert Today's Events (Markdown)" writes all today's events as bulleted list into active editor

### View State Persistence
- **Collapsed days:** `settings.collapsedDays: Record<string, boolean>` stores expand/collapse for each date section
- **Calendar visibility:** `settings.visibleCalendars` survives plugin reload
- **First run flag:** `settings.firstRun` triggers welcome message on initial load

## Code Conventions

- **Types:** All interfaces in [src/types.ts](../src/types.ts) - export `CalendarEvent`, `CalendarSource`, `ObsidianCalendarSettings`
- **Error handling:** Wrap iCal fetches in try/catch, show user-facing errors via `Notice()`
- **Obsidian API patterns:**
  - Register views: `this.registerView(VIEW_TYPE_SPCALENDAR, ...)`
  - Commands: `this.addCommand({ id, name, callback })` for palette integration
  - Settings tab: Extend `PluginSettingTab`, rebuild UI on changes
- **Styling:** CSS classes prefixed with `spcalendar-*` (e.g., `spcalendar-wrapper`, `spcalendar-header`). Inline styles used for dynamic colors.
- **Console logs:** Prefix with `[OCE]` or `[Obsidian Calendar Events]` for debugging

## File Organization

```
src/
  main.ts              # Plugin lifecycle, commands, ribbon
  graph.ts             # iCal parsing, recurring events, timezone logic
  settings.ts          # Settings UI tab
  types.ts             # TypeScript interfaces
  ui/
    CalendarView.ts    # Custom view rendering
  utils/
    tzidMap.ts         # Timezone normalization map
```

## Dependencies

- **Obsidian API:** `obsidian` module (externalized in rollup)
- **moment:** Date formatting in view layer
- **rrule:** Recurring event expansion
- **obsidian-daily-notes-interface:** Daily note integration

## Common Tasks

**Add new calendar source property:**
1. Update `CalendarSource` interface in [types.ts](../src/types.ts)
2. Add to `DEFAULT_SETTINGS` in [settings.ts](../src/settings.ts)
3. Update settings UI in `ObsidianCalendarSettingTab.display()`
4. Modify `CalendarClient` logic if needed

**Modify event rendering:**
- All DOM construction in `CalendarView.render()` - grouped by date, sorted by time
- Event click handlers call `addEventToNote()` for daily note insertion

**Change date range:**
- Adjust `settings.daysBefore` / `settings.daysAhead`
- Triggers re-fetch in `CalendarClient.fetchEvents()` via `buildDateRange()`
