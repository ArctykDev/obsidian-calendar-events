# Obsidian Calendar Events

A lightweight Obsidian plugin that displays events from an **iCal (ICS)** feed directly inside Obsidian.  

Designed for seamless integration with external calendar feeds such as Outlook, Google Calendar, or SharePoint calendar ICS links.

---

## ✨ Features

- 📅 View upcoming events from any iCal (.ics) feed inside Obsidian  
- 🗓️ Events automatically grouped and sorted by day  
- ⏱️ Configurable date range to control how far ahead events are displayed  
- ⚙️ Simple settings panel for configuration  
- 💡 Works entirely offline once data is fetched — no external dependencies beyond the Obsidian API

---

## 🧩 How It Works

This plugin reads events from a provided iCal (ICS) URL and displays them in a dedicated Obsidian view.  
Events are parsed, grouped by date, and presented in a clean, readable layout inside the app.

---

## 🛠 Installation

### Option 1 — Manual (Developer)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/YOUR-USERNAME/obsidian-calendar-events.git
   ```
2. Navigate to the plugin directory:

   ```bash
    cd obsidian-calendar-events
   ```
3. Install dependencies:

   ```bash
    npm install
   ```
4. Build the plugin:

   ```bash
    npm run build
   ```
5. Copy the following files to your vault’s plugin folder:

   ```bash
   <vault>/.obsidian/plugins/obsidian-calendar-events/
   ```
6. Include:

   ```bash
    main.js
    manifest.json
    styles.css (if present)
    ```
7. Restart Obsidian and enable Obsidian Calendar Events in the Community Plugins settings.

