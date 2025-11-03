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

    // Load saved settings
    await this.loadSettings();

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

    // On first load, show setup instructions if no calendar is configured
    this.app.workspace.onLayoutReady(async () => {
      const leaf = await this.activateView();
      const view = leaf.view as CalendarView;

      view.showLoading();
    
      if (!this.settings.icalUrl || this.settings.icalUrl.trim() === "") {
        console.log("[Obsidian Calendar Events] No calendar configured — showing setup message.");
        view.setEvents([]); // will trigger your CalendarView empty state
        new Notice("No calendar configured. Open plugin settings to add your iCal or Outlook calendar.");
        return;
      }
    
      try {
        const events = await this.calendar.fetchEvents();
        view.setEvents(events);
      } catch (err) {
        console.warn("[OCE] Startup fetch failed:", err);
        // Keep the header visible and show a non-blocking empty state
        view.setEvents([]);
        new Notice("Unable to load calendar events. Check your iCal URL or network.");
      }
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

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), data);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}