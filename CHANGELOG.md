# Changelog

All notable changes to the **Obsidian Calendar Events** plugin will be documented in this file.

## [0.9.0] — Obsidian Plugin Submission Prep

Released: 2026-09-25

This release addresses all items flagged during an internal audit against the official Obsidian plugin guidelines in preparation for community directory submission.

### Fixed

- **`detachLeavesOfType` removed from `onunload()`**  
  The Obsidian plugin guidelines explicitly prohibit this. When the plugin was unloaded, it was forcibly closing the calendar panel rather than letting Obsidian restore it on reload.

- **`Vault.modify` replaced with `Vault.process` for daily note insertion**  
  `process` is atomic and prevents write conflicts when other plugins modify the same note concurrently.

- **`window.setInterval` replaced with `this.registerInterval()`**  
  The "Updated X minutes ago" timer is now registered with Obsidian's component lifecycle and automatically cleaned up on plugin unload.

- **`openSettingsTab` private API made resilient**  
  The settings opener now uses optional chaining and falls back to a helpful notice if the internal API is unavailable, instead of logging an error to the console.

- **README corrected**  
  Fixed wrong plugin name ("SharePoint Calendar Events") and placeholder GitHub URL in the developer install section.

### Improved

- **Hardcoded inline styles moved to CSS**  
  All structural styles in `CalendarView.ts` (toggle bar layout, calendar filter buttons, loading/empty states, calendar dot) are now CSS classes. Only runtime-dynamic values (user-configured calendar colours) remain as inline styles. This allows themes and user snippets to customise the plugin's appearance.

- **Settings header simplified**  
  The redundant "Calendar Events Settings" `<h2>` heading (discouraged by Obsidian guidelines) is replaced with a version info `Setting` row.

- **Manifest description improved**  
  More specific and discoverable description for the community marketplace.

- **`FUNDING.yml` added**  
  GitHub Sponsor button now links to Buy Me a Coffee.

---

## [0.8.6] — Calendar URL Diagnostics

Released: 2026-09-24

### Fixed

- **Escape sequences displayed literally in event titles and locations**  \n  iCal TEXT properties escape special characters as `\,` `\;` `\n` `\\` per RFC 5545. The parser was passing these raw strings to the UI, so locations like `Location ON P0M 1N0\, Canada` displayed with the literal backslash-comma. A `unescapeText()` helper now strips all standard iCal escape sequences from SUMMARY and LOCATION before the event is stored.

- **Silent failure when a calendar URL is wrong or unreachable**  
  Fetch errors and invalid feed responses were only logged to the developer console, leaving users with no events and no explanation. Both cases now show a user-visible `Notice`. A network/HTTP failure reports the error message; a URL that returns non-iCal content (e.g. an HTML page) tells the user to check they are using the iCal export link, not a web address.

### Added

- **"Test URL" button per calendar in settings**  
  Each calendar row in settings now has a wifi icon button that fetches the configured URL and reports inline whether it is a valid iCal feed and how many event blocks it contains, or explains why it failed. This makes it easy to validate a Google Calendar secret address or any other ICS URL before saving.

---

## [0.8.5] — Bug Fixes & Improvements

Released: 2026-09-24

### Fixed

- **All-day events displayed "12:00 AM → 12:00 AM" instead of "All Day"**  
  Events with `VALUE=DATE` (no time component) now carry an `isAllDay` flag set during parsing. The view renders "All Day" for these events, and the daily note insertion task omits the time range. The RFC 5545 DTEND exclusion logic in the filter now uses this proper flag instead of a fragile midnight-UTC regex heuristic.

- **Untracked `setTimeout` for scroll-to-today could fire on a detached DOM**  
  The 250ms scroll timer was not cancelled when `render()` was called again before it fired. It is now stored in `scrollTimer`, cleared at the start of each render, and cleaned up in `onClose()`.

- **Sort-order toggle command made an unnecessary network fetch**  
  After toggling sort order, the command re-fetched all calendar URLs even though the view already held the events. It now calls `view.refresh()` to re-render with the existing event list.

### Improved

- **Double-sorting removed**  
  `parseICS()` was sorting its return value before `fetchEvents()` sorted the merged output. The inner sort is removed; only the final sort after merging all calendars remains.

- **Settings text fields now debounce saves**  
  Calendar name, URL, days before/after, and heading name fields previously wrote to disk on every keystroke. They now wait 500ms after the last keystroke before saving.

- **Removed chatty `console.log` statements from fetch path**  
  Per-fetch debug logs (VEVENT block counts, per-calendar event counts, filtered event counts) are removed from production. Warnings and errors are retained.

---

## [0.8.4] — Bug Fixes

Released: 2026-09-24

### Fixed

- **"Days after today" setting could not be set to 0**  
  `parseInt(value) || 7` treated `0` as falsy and silently reverted to `7`. Now uses `parseInt(value, 10)` with an explicit `isNaN` guard so `0` is accepted as a valid value. Same pattern applied to "Days before today" for consistency.
- **Stale closure in calendar visibility toggle buttons**  
  Each toggle button captured `isVisible` at render time. Clicking a button set the visibility to `!capturedValue` rather than toggling the live current value. The handler now reads `this.visibleCalendars[cal.id]` at click time.

- **`raw` field on `CalendarEvent` stored full ICS block strings unnecessarily**  
  Every parsed event held a reference to its raw ICS text (non-recurring) or master object (recurring). This was never used in the UI and created significant memory overhead for large calendars. Removed from the `CalendarEvent` type and all three construction sites in the parser.

- **Race condition between `saveSettings()` and `render()` in `setEvents()`**  
  `saveSettings()` was called without `await`, meaning `render()` could execute before the settings write completed. If a visibility toggle or refresh triggered a second save before the first finished, write order was undefined. `setEvents()` is now `async` and all call sites `await` it.

- **Events from the previous day appearing when \"Days before today\" is 0**  
  A 12-hour buffer was subtracted from `startBoundary` before filtering events, extending the visible window 12 hours into the previous day. `parseICS` already receives the correct un-buffered boundaries so the buffer served no purpose there. Removed; the filter now uses `startBoundary` and `endBoundary` directly.
- **"Insert Today's Events" command used UTC date instead of local date**  
  Today's events were filtered by comparing UTC ISO strings with `new Date().toISOString().slice(0, 10)`. Users west of UTC would miss late-evening events (already next day in UTC), and users east of UTC would see next-day events. Now compares the event's local date against the user's local today. Event times in the inserted Markdown are also formatted using the local clock via `Intl.DateTimeFormat`.

---

## [0.8.3] — Recurring Event DST Fix & Timezone Map Expansion

Released: 2026-03-23

This release fixes a DST-related time offset bug specific to recurring calendar events and expands the Windows timezone name map to cover all major global regions.

### Fixed

- **Recurring events off by 1 hour after DST transitions**  
  Recurring event expansion (RRULE) was building `DTSTART` from the UTC-converted ISO string rather than the original wall-clock value from the ICS. This caused rrule to repeat the same UTC instant each week, which is correct while the UTC offset stays the same but produces a 1-hour error on every occurrence after a spring-forward or fall-back transition. Fixed by passing the original raw `DTSTART` wall-clock string to rrule as a floating (no Z) time, then re-converting each generated occurrence to UTC using the original TZID and the DST-aware `zonedWallTimeToUTCISO` function. UTC-stamped events (explicit Z suffix) continue to use the UTC-based path since UTC has no DST.

- **Missing Windows timezone TZID names causing incorrect UTC conversion**  
  The `normalizeTZID` map contained only 11 entries and was missing all `*Daylight Time` variants (e.g. `Eastern Daylight Time`, `Pacific Daylight Time`) used by Outlook and Exchange during summer months, all European Windows timezone names (`W. Europe Standard Time`, `GMT Standard Time`, etc.), and all Asian/Pacific/Australian names. Unrecognised names fell through to the Intl catch block and were treated as UTC, producing an offset equal to the full timezone difference. Replaced the stub map with a comprehensive CLDR-derived map covering all standard Windows timezone names globally.

- **Quoted TZID values not recognised**  
  Some calendar servers emit `TZID="America/New_York"` with surrounding quotes. The captured string included the quotes, making it unrecognisable to both the map and `Intl`. `readProp` now strips leading and trailing single or double quotes from TZID values before normalisation.

- **`readProp` splitting on first `:` only**  
  Property values containing colons (e.g. URLs in `LOCATION` or `DESCRIPTION`) were silently truncated. `readProp` now uses `indexOf(":")` and `slice` so only the first colon is treated as the key/value separator.

- **Unrecognised timezone IDs now logged as warnings**  
  Added a `[OCE] Unrecognised timezone` console warning in the Intl fallback path so edge-case TZID strings from specific calendar servers can be identified and added to the map.

### Internal

- **CI: `package-lock.json` committed**  
  `npm ci` (used in the GitHub Actions release workflow) requires a lock file. One was never committed, so every CI run failed at the install step. Lock file is now present.

- **CI: `minAppVersion` corrected in workflow**  
  The release workflow was writing `"1.4.0"` as the minimum Obsidian version into `versions.json` on every release. Corrected to `"1.5.0"` to match `manifest.json`.

- **Security: Rollup and minimatch patched**  
  Updated Rollup from `^4.12.0` to `^4.60.0` (fixes GHSA-mw96-cpmx-2vgc: Arbitrary File Write via Path Traversal) and patched transitive `minimatch` ReDoS vulnerabilities.

---

## [0.8.2] — Timezone & DST Fixes, Code Quality, and Settings Corrections

Released: 2026-03-23

This release fixes a DST-related time offset bug that caused events to display 1 hour ahead on or after a daylight saving transition, corrects several settings UI and calendar view issues, and improves internal code quality.

### Fixed

- **Events showing 1 hour ahead after DST transitions**  
  The UTC conversion algorithm (`zonedWallTimeToUTCISO`) used an Intl probe at a naive UTC timestamp that could straddle a DST boundary in the wrong direction. The offset it calculated belonged to the wrong DST regime (e.g., EST instead of EDT), shifting events by exactly 1 hour. Added a verification step that re-evaluates the UTC offset at the candidate time and corrects the result when the DST state differs. Events on non-transition days are completely unaffected.

- **Floating-time events displayed at wrong local time**  
  Floating iCal times (no TZID, no Z suffix) were converted to UTC with an erroneous double timezone-offset subtraction. The fix uses `new Date(y, m, d, h, min, s).toISOString()` directly, which correctly converts local wall time to UTC.

- **DST-unsafe date range boundary calculation**  
  `startBoundary` and `endBoundary` were computed using raw millisecond arithmetic (`Date.getTime() ± days * 86400000`). On spring-forward days this lands 1 hour past midnight, causing all-day events at the start of that day to be missed. Replaced with `setDate()` which operates in local calendar days and is immune to DST transitions.

- **"Show ribbon icon" setting only visible when "Add under heading" was enabled**  
  The ribbon icon toggle was incorrectly nested inside the `addUnderHeading` conditional block in the settings UI. Moved it outside so it is always visible.

- **`scroll-to-today` command scrolled the browser window instead of the plugin pane**  
  The command used `document.querySelector` + `window.scrollTo`, which has no effect inside Obsidian's panel layout. Changed to query inside the view's own container and use `scrollIntoView`.

- **`ReferenceError` in collapse-all button handler when events list is empty**  
  The collapse-all button's event listener referenced `const grouped` before it was declared, which would throw a `ReferenceError` if the user clicked the button while the view was in its empty state. Pre-computed `grouped` at the top of `render()` before any early returns.

- **Unescaped user input passed to `new RegExp()`**  
  The `headingName` setting was used raw in a `new RegExp()` constructor when inserting events into daily notes. Special regex characters (e.g. `(`, `.`, `*`) in the heading name would produce an invalid or unintended regex. Added proper escaping before constructing the expression.

- **`window.setInterval` timer leaked on view close**  
  The "updated X minutes ago" display timer had no cleanup when the view was detached. Added an `onClose()` lifecycle method to `CalendarView` that clears the interval.

### Improved

- **Removed redundant internal type**  
  The internal `CalendarEventWithCalendar` interface in `graph.ts` extended `CalendarEvent` with fields that were already defined on that interface. Removed the duplicate and typed all usages directly as `CalendarEvent`.

- **Removed unnecessary `as any` casts in `CalendarClient`**  
  `(this.settings as any).calendars` and `src: any` were replaced with properly-typed `CalendarSource[]`, restoring full type safety in the fetch pipeline.

- **Added missing `rimraf` dev dependency**  
  The `clean` npm script called `rimraf` but it was not declared in `devDependencies`. Added `rimraf ^5.0.0`.

---

## [0.8.1] — Google Calendar Support and Cache-Busting Fix

Released: 2026-01-24

This release fixes critical issues preventing Google Calendar ICS feeds from displaying events and ensures the refresh button always fetches fresh calendar data.

### Fixed

- **Google Calendar ICS Parsing**  
  Fixed parsing of UTC timestamps with 'Z' suffix (e.g., `20260124T150000Z`). Google Calendar events were previously skipped due to incorrect date parsing logic. Now properly handles compact iCal format by converting to UTC before parsing.

- **Calendar Refresh Caching Issue**  
  Added cache-busting HTTP headers (`Cache-Control`, `Pragma`, `Expires`) to ensure the refresh button always fetches fresh data from calendar servers instead of returning cached results.

- **Individual Calendar Error Handling**  
  Improved error handling so that failures in one calendar feed don't crash the entire plugin. Each calendar now has independent error handling with console warnings.

### Improved

- **Enhanced Diagnostic Logging**  
  Added detailed console logging showing:
  - Number of VEVENT blocks parsed per calendar
  - Number of events successfully parsed from each calendar
  - Warnings for skipped events with missing UIDs or invalid dates
  - Per-calendar fetch failures with specific error messages

---

## [0.8.0] — UI Enhancements, Ribbon Icon, and Recurring Event Indicators

Released: 2025-01-22

This release introduces several user-experience improvements, visual refinements inspired by Microsoft Outlook, a new optional ribbon icon, and multiple interaction and layout enhancements.

### Added

- **Optional Ribbon Icon**  
  A new setting allows users to enable/disable a dedicated ribbon icon for quickly opening the Calendar Events view.
- **Recurring Event Indicator**  
  Events generated from recurrence rules are now clearly marked with a recurring icon.
- **Outlook-Style Ghost Hover Button**  
  The _Add to Daily Note_ button now matches Outlook’s “ghost-hover” style with a subtle circular hover region.
- **Day Group Collapse Button Rewrite**  
  Day headers now use a modern ghost-hover collapse icon for clearer interaction and visual consistency.

### Improved

- **Event Card Layout**  
  The Add-to-Daily-Note button is now positioned at the bottom-right of each event card, avoiding overlap with other UI elements.
- **Cleaner Hover Interactions**  
  Event action UI now appears without shifting layout or leaving empty rows.
- **Visual Consistency Across Elements**  
  Icons now follow a unified UI language (spacing, hover transitions, scaling).
- **Internal Settings Handling**  
  Ribbon icon state updates immediately when toggled in the settings panel.

### Fixed

- Resolved layout gaps caused by empty action rows.
- Removed inconsistent spacing around event cards during hover interactions.
- Ensured the collapse icon and add-button no longer interfere with event title or recurring indicators.

---

## Notes

This release does not introduce any breaking changes but does enhance UI consistency and interaction quality.  
Recommended for all users.

## [0.7.0] - 2025-11-05

### Multi-Calendar Management, Visibility Toggles, and Expand/Collapse Controls

This release marks a major enhancement to **Obsidian Calendar Events**, introducing full **multi-calendar support**, persistent **visibility toggles**, and new **expand/collapse controls** for a cleaner and more customizable viewing experience.

---

### **New Features**

- **Multiple ICS Calendar Sources**  
  Manage multiple `.ics` calendar feeds directly from the plugin settings.  
  Each source includes:

  - Custom **name**
  - **Feed URL**
  - **Color**
  - **Enable/disable toggle**

- **Color-Coded Events**  
  Events are now visually color-coded according to their calendar source for better clarity.

- **Per-Calendar Visibility Toggles**  
  A new toggle bar at the top of the calendar view allows users to show or hide specific calendars.

  - Color-coded to match each calendar
  - Visibility states are **persisted between sessions**

- **Expand/Collapse Date Headers**  
  Each day’s events can now be expanded or collapsed individually.

  - Collapsed states are **remembered between sessions**
  - Adds a cleaner browsing experience when viewing multiple days

- **Collapse/Expand All Button**  
  A header button (chevrons icon) now allows users to quickly collapse or expand all days.

  - Icon and tooltip update dynamically based on current state
  - Fully synchronized with individual day states

- **Calendar Legend**  
  Displays active calendars and their associated colors for an at-a-glance overview.

---

### **UI Enhancements**

- Centered and styled visibility toggle buttons using a Flexbox layout
- Added smooth hover and transition effects to toggle buttons
- Improved spacing and visual hierarchy in the calendar header and event list
- Enhanced header area with dynamic Collapse/Expand All control
- Refined empty and loading states to support multi-calendar use cases

---

### **Technical Updates**

- **Settings Schema Updated**
  - Added `calendars[]` for multiple ICS sources
  - Added `visibleCalendars` to persist calendar visibility
  - Added `collapsedDays` to persist expanded/collapsed states
- **Timezone Handling**
  - Added `tzidMap.ts` utility to normalize Microsoft/Windows-style TZIDs
  - Fixed incorrect timezone conversion for Outlook and Google Calendar feeds
  - Events now display in the correct local time zone
- **CalendarClient**
  - Merges events from all enabled calendars concurrently
  - Improved UTC normalization and filtering accuracy
- **CalendarView**
  - Renders per-calendar color, toggles, and grouped days
  - Supports expand/collapse persistence and global collapse button

---

### **Migration Notice**

Users upgrading from **v0.6.x** will have their existing single `iCal URL` automatically migrated to a new multi-calendar format.  
No manual action is required — existing events, preferences, and view settings are preserved.

---

### **Summary**

Version **0.7.0** delivers a powerful evolution of Obsidian Calendar Events:

- Full multi-calendar management
- Color-coded and filterable events
- Persistent expand/collapse and visibility states
- Accurate timezone support

This release sets the stage for even more interactive, visually-rich calendar experiences within Obsidian.

---

## [0.6.4] - 2025-11-03

### New Features

- **Dynamic “Last Updated” label**  
   Displays when calendar data was last fetched. Updates automatically every minute (for example, “Updated 5 minutes ago”) and hides automatically after 24 hours of inactivity.
- **Loading indicator**  
   Added a lightweight “Loading events…” message with a subtle spinner when the plugin first loads or when the user clicks Refresh.
- **Welcome and setup screen**  
   When no calendar is configured, the plugin now shows a friendly welcome message with an **Open Settings** button. The header and toolbar remain visible for a consistent interface.
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
