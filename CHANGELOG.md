# Changelog

All notable changes to the **Obsidian Calendar Events** plugin will be documented in this file.

---

## **v0.5.1** — Add to Daily Note Feature  
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

## **v0.5.0** — Stable Release  
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
