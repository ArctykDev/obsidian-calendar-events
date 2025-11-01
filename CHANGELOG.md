# Changelog

All notable changes to the **Obsidian Calendar Events** plugin will be documented in this file.



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
