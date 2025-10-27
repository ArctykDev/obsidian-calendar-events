# 📜 Changelog

All notable changes to **Obsidian Calendar Events** will be documented in this file.  
This project follows [Semantic Versioning](https://semver.org/) and the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) standard.

---

![Version](https://img.shields.io/github/v/release/ArctykDev/obsidian-calendar-events?label=Latest%20Version&style=for-the-badge)
![Build](https://img.shields.io/github/actions/workflow/status/ArctykDev/obsidian-calendar-events/build.yml?style=for-the-badge)
![License](https://img.shields.io/github/license/ArctykDev/obsidian-calendar-events?style=for-the-badge)

---

## [Unreleased]
### 🚧 Planned Features
- Support for **Outlook** and **Microsoft 365 Group** calendars via Microsoft Graph
- Integration with **SharePoint List** calendars
- **Device Code Authentication** for Microsoft accounts
- Event color-coding by calendar source
- Inline event **insertion into Obsidian notes**
- **Search and filtering** of events
- **Month/Week calendar view** mode
- Customizable event display themes and layout improvements

---

## [0.5.0] - 2025-10-27  
**Milestone:** *First functional ICS-only release*

### ✨ Added
- Initial release of **Obsidian Calendar Events**  
- Fetches and displays events from **iCal (.ics)** feeds
- Groups and sorts events by day using `moment.js`
- Introduces plugin settings for:
  - iCal URL input  
  - Configurable date range (in days)
- Adds command palette entry: **“Refresh Calendar Events”**
- Displays events in a clean, date-grouped format inside Obsidian
- Includes fallback message when no events are available

### ⚙️ Technical
- Written entirely in **TypeScript**
- Bundled using **Rollup**
- Built against the **Obsidian API v1.4.0+**
- Lightweight and dependency-minimal implementation
- Compatible with desktop and mobile Obsidian builds

---

## [0.1.0] - 2025-10-20  
**Milestone:** *Prototype and structural groundwork*

### 🧩 Added
- Basic Obsidian panel integration for displaying placeholder events  
- Created settings tab and configuration storage
- Established project architecture and Rollup build process  
- Plugin renamed from **SharePoint Calendar Events** → **Obsidian Calendar Events**

---

## 🔖 Versioning

This project uses **semantic versioning** (`MAJOR.MINOR.PATCH`):

| Increment | When to Use |
|------------|-------------|
| **MAJOR** | Breaking API or settings changes |
| **MINOR** | New features added (non-breaking) |
| **PATCH** | Bug fixes, optimizations, or small tweaks |

Example:

```bash
0.5.0 → 0.6.0 = New feature (non-breaking)
0.6.0 → 1.0.0 = First stable public release
```

---

## 🧩 Links

- 🏷️ [Latest Release](https://github.com/ArctykDev/obsidian-calendar-events/releases/latest)  
- 🧠 [Open Issues](https://github.com/ArctykDev/obsidian-calendar-events/issues)  
- ⚙️ [Pull Requests](https://github.com/ArctykDev/obsidian-calendar-events/pulls)  

---

## 🪪 License

Licensed under the [MIT License](LICENSE).  
Copyright © 2025 **Arctyk**
