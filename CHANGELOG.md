# Changelog

All notable changes to the **Obsidian Calendar Events** plugin will be documented in this file.

## [0.6.4] - 2025-11-03

### New Features

- **Dynamic “Last Updated” label**  
    Displays when calendar data was last fetched. Updates automatically every minute (for example, “Updated 5 minutes ago”) and hides automatically after 24 hours of inactivity.    
- **Loading indicator**  
    Added a lightweight “Loading events…” message with a subtle spinner when the plugin first loads or when the user clicks Refresh.    
- **Welcome and setup screen**  
    When no calendar is configured, the plugin now shows a friendly welcome message with an **Open Settings** button.  The header and toolbar remain visible for a consistent interface.    
- **Auto-loading on startup**  
    The calendar automatically fetches events on startup if an iCal URL is configured, removing the need for manual refresh.    
- **Smarter refresh logic**  
    The Refresh button now handles first-run conditions correctly. If no calendar is configured, it shows the setup screen instead of an endless spinner.    

### UI Improvements

- **Cleaner layout**  
    The “Showing events…” and “Last updated…” lines are hidden when no calendar is configured (first-run or setup state).    
- **Consistent styling**  
    Improved text alignment and spacing across all header, loading, and empty states.    
- **Optional fade transition**  
    Added an optional opacity transition when switching from the loading spinner to the event view (enabled through CSS).   

### Technical Enhancements

- Added a `showLoading()` helper to `CalendarView` for unified loading behavior during startup and refresh operations.    
- Introduced `lastUpdated` and `updateTimer` class fields with proper cleanup in `onunload()` to prevent memory leaks.    
- Updated the `onLayoutReady()` startup logic to show the loading indicator and handle both configured and first-run states cleanly.    
- Minor CSS refinements for `.spcalendar-loading`, `.spcalendar-empty`, and `.spcalendar-updated` to align with the Obsidian design language.
    

### Tested Scenarios

- First run with no calendar configured → welcome message with **Open Settings** button    
- Startup with configured calendar → loading spinner → event list    
- Manual refresh (configured) → loading spinner → refreshed events    
- Manual refresh (unconfigured) → setup message (no infinite spinner)    
- Timestamp automatically hides after 24 hours    

### Summary

This release focuses on refining the user experience, improving the startup flow, and providing clear visual feedback for loading, configuration, and refresh states. It lays the groundwork for more advanced calendar management in future versions.

---

## [0.6.3] - 2025-11-01
### Full Outlook Compatibility and iCal Improvements

This release delivers a major enhancement to iCal (ICS) event handling — bringing full compatibility with Outlook and Microsoft 365 calendar feeds.  
It resolves previous issues where some events appeared late, all-day events were missing, or recurring meetings failed to display.

#### ICS Parsing
- Rebuilt the `parseICS()` function for full **Outlook/Exchange compatibility**.  
- Added support for:
  - **Folded multi-line fields** (RFC 5545 compliant).  
  - **Escaped text** (commas, semicolons, and backslashes).  
  - **All-day events** using `VALUE=DATE`.  
  - **Local time zone handling (`TZID=…`)** with correct UTC conversion.  
  - **Canceled or modified events** (`STATUS:CANCELLED`, `RECURRENCE-ID`).  
- Normalized all timestamps to UTC for consistent rendering in Obsidian.

#### Recurrence (RRULE) Expansion
- Integrated the **`rrule`** library to expand recurring events exactly as Outlook does.  
- Handles:
  - Daily, weekly, monthly, and custom recurrence patterns.  
  - Exclusions and cancellations within a recurring series.  
- Prevents duplicate or missing recurring instances.

#### Event Filtering and Date Range
- Adjusted `fetchEvents()` to calculate ranges using **local midnight boundaries**, ensuring complete coverage of each day.  
- Added a 12-hour buffer on both sides of the date window to capture early-morning and late-night events.  
- Improved overlap logic so events spanning multiple days or starting before/ending after the range are always included.

#### Diagnostics and Stability
- Added detailed console diagnostics for troubleshooting event visibility and time-zone alignment.  
- Improved error handling for malformed ICS data.  
- Enhanced performance and parsing stability.

---

### Result
The plugin now matches Outlook’s calendar view exactly — including recurring meetings, all-day events, cancellations, and localized start/end times — while maintaining smooth performance and reliability inside Obsidian.

---

## [v0.6.0] — UI Improvements  
**Release Date:** 2025-10-28  

### New Features
- Added **“No events”** message for days without any calendar entries.
- Improved **calendar header** to use a theme-aware background with transparency and `backdrop-filter` blur.
- Enhanced UI consistency with Obsidian’s built-in and community themes.

### Improvements
- Reordered vendor-prefixed CSS properties for linter compliance.
- Prevented event cards from scrolling underneath the sticky header.
- Updated version numbers in `manifest.json`, `package.json`, and `versions.json`.

---

## [v0.5.1] — Add to Daily Note Feature  
**Release Date:** 2025-10-28  

### New Features
- Added the ability to insert calendar events directly into your Daily Note.
- Events are now added as Markdown checklist items (`- [ ] ...`).
- Introduced new settings:
  - **Add Events Under Heading** — toggle whether to insert events under a specific heading.
  - **Heading Name** — specify the heading under which events are added.
- Automatically creates the heading if it does not exist.
- Prevents duplicate blank lines between heading and newly inserted tasks.

### Improvements
- Improved note formatting consistency when adding multiple events.
- Maintains all existing calendar features (sorting, pinned today, refresh button, and iCal support).

---

## [0.5.0] — Stable Release  
**Release Date:** 2025-10-25  

### Highlights
- Initial public release of **Obsidian Calendar Events**.
- Added iCal event fetching and grouping by day.
- Added sorting options (ascending/descending).
- Added “Pin Today” feature to always keep the current day’s events visible.
- Added Refresh and Settings controls within the calendar view.
- Display range configuration (days before and after today).

---

### Versioning
This plugin follows [Semantic Versioning](https://semver.org/):
- **MAJOR** — Breaking changes  
- **MINOR** — New features, backward-compatible  
- **PATCH** — Fixes or small improvements
