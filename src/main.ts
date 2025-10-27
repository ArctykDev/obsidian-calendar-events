import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { CalendarClient } from "./graph";
import type { CalendarEvent, ObsidianCalendarSettings } from "./types";
import { CalendarView, VIEW_TYPE_SPCALENDAR } from "./ui/CalendarView";
import { ObsidianCalendarSettingTab, DEFAULT_SETTINGS } from "./settings";

export default class ObsidianCalendarPlugin extends Plugin {
  settings!: ObsidianCalendarSettings;
  calendar!: CalendarClient;

  async onload() {
    console.log("Loading Obsidian Calendar Events plugin");

    // Load saved settings and inject styling
    await this.loadSettings();
    this.injectStyles();

    // Initialize iCal calendar client
    this.calendar = new CalendarClient(this.settings);

    // Register custom calendar view
    this.registerView(VIEW_TYPE_SPCALENDAR, (leaf) => new CalendarView(leaf, this));

    // Refresh calendar events
    this.addCommand({
      id: "oce-refresh-events",
      name: "Refresh Calendar Events",
      callback: async () => {
        try {
          const events = await this.calendar.fetchEvents();
          await this.pushToView(events);
          new Notice(`Fetched ${events.length} events.`);
        } catch (e: any) {
          new Notice(`Fetch failed: ${e?.message || e}`);
        }
      },
    });

    // Insert today's events as markdown
    this.addCommand({
      id: "oce-insert-todays-events",
      name: "Insert Today's Events (Markdown)",
      editorCallback: async (editor) => {
        try {
          const events = await this.calendar.fetchEvents();
          const today = new Date().toISOString().slice(0, 10);
          const md = [
            `### Events for ${today}`,
            ...events.map(
              (e) =>
                `- **${e.subject}** (${e.start} → ${e.end})${
                  e.location ? ` — _${e.location}_` : ""
                }`
            ),
          ].join("\n");
          editor.replaceSelection(md + "\n");
          new Notice(`Inserted ${events.length} events.`);
        } catch (e: any) {
          new Notice(`Insert failed: ${e?.message || e}`);
        }
      },
    });

    // Toggle sort order (Asc/Desc)
    this.addCommand({
      id: "oce-toggle-sort-order",
      name: "Toggle Sort Order (Asc/Desc)",
      callback: async () => {
        this.settings.sortOrder =
          this.settings.sortOrder === "asc" ? "desc" : "asc";
        await this.saveSettings();
        new Notice(`Sort order set to ${this.settings.sortOrder.toUpperCase()}.`);
        const events = await this.calendar.fetchEvents();
        await this.pushToView(events);
      },
    });

    // Scroll to today's section
    this.addCommand({
      id: "oce-scroll-to-today",
      name: "Scroll to Today",
      callback: async () => {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_SPCALENDAR)[0];
        if (!leaf) {
          new Notice("Calendar view is not active.");
          return;
        }

        const todayElement = document.querySelector(".spcalendar-today") as HTMLElement;
        if (!todayElement) {
          new Notice("No 'Today' section found.");
          return;
        }

        const headerOffset = 60;
        const targetPosition =
          todayElement.getBoundingClientRect().top + window.scrollY - headerOffset;

        window.scrollTo({ top: targetPosition, behavior: "smooth" });
        new Notice("Scrolled to Today");
      },
    });

    // Add settings tab
    this.addSettingTab(
      new ObsidianCalendarSettingTab(this.app, this, this.settings, () =>
        this.saveSettings()
      )
    );

    // Inject a demo event to confirm layout
    this.app.workspace.onLayoutReady(async () => {
      const testEvent: CalendarEvent = {
        id: "demo1",
        subject: "Test Event",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        location: "Obsidian Test",
        raw: {},
      };
      await this.pushToView([testEvent]);
      new Notice("Demo event added to calendar view.");
    });
  }

  onunload() {
    console.log("Unloading Obsidian Calendar Events plugin");
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_SPCALENDAR);
  }

  async activateView(): Promise<WorkspaceLeaf> {
    let leaf =
      this.app.workspace.getLeavesOfType(VIEW_TYPE_SPCALENDAR)[0] ||
      this.app.workspace.getRightLeaf(false) ||
      this.app.workspace.getLeaf(true);

    await leaf.setViewState({ type: VIEW_TYPE_SPCALENDAR, active: true });
    this.app.workspace.revealLeaf(leaf);
    return leaf;
  }

  private async pushToView(events: CalendarEvent[]) {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_SPCALENDAR)[0];
    if (!leaf) {
      leaf = await this.activateView();
    }
    const view = leaf.view as CalendarView;
    view.setEvents(events);
  }

  async openSettingsTab(): Promise<void> {
    try {
      const setting = (this.app as any).setting;
      if (!setting) {
        new Notice("Settings interface not available yet. Try again in a moment.");
        return;
      }
      await setting.open();
      setting.openTabById(this.manifest.id);
    } catch (err) {
      console.error("Error opening settings tab:", err);
      new Notice("Failed to open Obsidian Calendar Events settings.");
    }
  }

  private injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      /* Main wrapper */
      .spcalendar-wrapper {
        padding: 16px 18px 24px 18px;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        height: 100%;
        background: var(--background-primary);
        border-radius: 6px;
        box-sizing: border-box;
        scrollbar-width: thin;
        scrollbar-color: var(--scrollbar-thumb) var(--background-primary);
      }
  
      .spcalendar-wrapper::-webkit-scrollbar { width: 8px; }
      .spcalendar-wrapper::-webkit-scrollbar-thumb {
        background-color: var(--scrollbar-thumb);
        border-radius: 4px;
      }
      .spcalendar-wrapper::-webkit-scrollbar-track {
        background: var(--background-primary);
      }
  
      /* Header with title + controls */
      .spcalendar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 1.3em;
        font-weight: 700;
        color: var(--text-normal);
        border-bottom: 1px solid var(--background-modifier-border);
        padding-bottom: 6px;
        margin-bottom: 1em;
        position: sticky;
        top: 0;
        background: var(--background-primary);
        z-index: 15;
      }
  
      .spcalendar-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }
  
      .spcalendar-header-right {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }
  
      /* Sort indicator */
      .spcalendar-sort-indicator {
        cursor: pointer;
        font-size: 1.1em;
        color: var(--text-accent);
        transition: transform 0.3s ease, color 0.2s ease;
        display: inline-block;
        transform-origin: center;
      }
  
      .spcalendar-sort-indicator:hover {
        color: var(--interactive-accent);
        transform: scale(1.15);
      }
  
      .spcalendar-sort-indicator.rotated { transform: rotate(180deg); }
  
      /* Settings button */
      .spcalendar-settings-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        transition: color 0.2s ease, transform 0.2s ease;
      }
  
      .spcalendar-settings-btn:hover {
        color: var(--interactive-accent);
        transform: scale(1.15);
      }
  
      /* Range text */
      .spcalendar-range {
        font-size: 0.85em;
        color: var(--text-muted);
        margin-bottom: 1em;
        text-align: left;
        padding-left: 2px;
      }
  
      /* Day section headers */
      .spcalendar-day {
        margin-top: 1.6em;
        padding-left: 12px;
        padding-right: 4px;
        position: relative;
      }
  
      .spcalendar-day::before {
        content: "";
        position: absolute;
        top: 2.8em;
        left: 4px;
        bottom: 0;
        width: 2px;
        background: var(--background-modifier-border);
        opacity: 0.5;
        border-radius: 1px;
      }
  
      .spcalendar-day-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75em;
        padding: 6px 8px 6px 4px;
        border-bottom: 1px solid var(--background-modifier-border);
        position: sticky;
        top: 42px;
        background: var(--background-primary);
        z-index: 10;
      }
  
      .spcalendar-day-header h3 {
        font-size: 1.05em;
        font-weight: 600;
        color: var(--text-accent);
        margin: 0;
      }
  
      /* Badge for event count */
      .spcalendar-badge {
        display: inline-block;
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
        font-size: 0.8em;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 12px;
        min-width: 24px;
        text-align: center;
        line-height: 1.4;
        animation: spcalendar-pulse 0.9s ease;
      }
  
      @keyframes spcalendar-pulse {
        0% { transform: scale(0.95); opacity: 0.6; }
        40% { transform: scale(1.2); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
  
      /* Today highlighting */
      .spcalendar-today {
        border: 1px solid var(--interactive-accent);
        border-radius: 8px;
        background-color: var(--background-secondary-alt);
        padding: 8px 10px 10px 10px;
        margin-top: 1em;
        box-shadow: 0 0 8px rgba(0, 0, 0, 0.05);
      }
  
      .spcalendar-today .spcalendar-day-header h3 {
        color: var(--interactive-accent);
        font-weight: 700;
      }
  
      /* Event cards */
      .spcalendar-event {
        background-color: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-left: 4px solid var(--interactive-accent);
        border-radius: 8px;
        padding: 10px 14px;
        margin-bottom: 0.7em;
        margin-left: 16px;
        margin-right: 4px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
        transition: background-color 0.2s ease, box-shadow 0.2s ease;
        position: relative;
      }
  
      .spcalendar-event:hover {
        background-color: var(--background-primary-alt);
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.12);
      }
  
      .spcalendar-event-title {
        font-weight: 600;
        font-size: 1em;
        color: var(--text-normal);
        margin-bottom: 0.25em;
      }
  
      .spcalendar-time,
      .spcalendar-location {
        font-size: 0.85em;
        color: var(--text-muted);
        margin-top: 2px;
      }
  
      .spcalendar-location::before {
        content: "📍 ";
      }
  
      /* Light mode enhancements */
      @media (prefers-color-scheme: light) {
        .spcalendar-wrapper {
          background: var(--background-primary);
        }
  
        .spcalendar-event {
          background-color: var(--background-secondary);
          border-color: var(--background-modifier-border);
        }
  
        .spcalendar-day::before {
          opacity: 0.4;
        }
  
        .spcalendar-today {
          background-color: var(--background-secondary);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }
      }
  
      /* Dark mode enhancements */
      @media (prefers-color-scheme: dark) {
        .spcalendar-wrapper {
          background: var(--background-primary);
        }
  
        .spcalendar-event {
          background-color: var(--background-secondary-alt);
          border-color: var(--background-modifier-border);
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.25);
        }
  
        .spcalendar-day::before {
          opacity: 0.6;
        }
  
        .spcalendar-today {
          background-color: var(--background-secondary);
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.05);
        }
      }
    `;
    document.head.appendChild(style);
  } 

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), data);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
