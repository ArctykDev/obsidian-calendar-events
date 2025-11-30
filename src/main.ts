import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { CalendarClient } from "./graph";
import type { CalendarEvent, ObsidianCalendarSettings } from "./types";
import { CalendarView, VIEW_TYPE_SPCALENDAR } from "./ui/CalendarView";
import { ObsidianCalendarSettingTab, DEFAULT_SETTINGS } from "./settings";

export default class ObsidianCalendarPlugin extends Plugin {
  settings!: ObsidianCalendarSettings;
  calendar!: CalendarClient;

  private ribbonEl: HTMLElement | null = null;   // <-- NEW

  async onload() {
    console.log("[Obsidian Calendar Events] Loading plugin...");

    // Load saved settings (and migrate old single-calendar configs)
    await this.loadSettings();

    // Initialize multi-calendar client
    this.calendar = new CalendarClient(this.settings);

    // Register the custom calendar view
    this.registerView(VIEW_TYPE_SPCALENDAR, (leaf) => new CalendarView(leaf, this));

    // ----------------------------------
    // RIBBON ICON (NEW)
    // ----------------------------------
    this.refreshRibbonIcon();

    // -----------------------------
    // COMMANDS
    // -----------------------------

    // Refresh events
    this.addCommand({
      id: "oce-refresh-events",
      name: "Refresh Calendar Events",
      callback: async () => {
        try {
          const enabled = this.settings.calendars.filter((c) => c.enabled);
          if (!enabled.length) {
            new Notice("No enabled calendars configured.");
            return;
          }

          const events = await this.calendar.fetchEvents();
          await this.pushToView(events);
          new Notice(`Fetched ${events.length} events.`);
        } catch (e: any) {
          console.error("[OCE] Refresh failed:", e);
          new Notice(`Fetch failed: ${e?.message || e}`);
        }
      },
    });

    // Insert today’s events as Markdown
    this.addCommand({
      id: "oce-insert-todays-events",
      name: "Insert Today's Events (Markdown)",
      editorCallback: async (editor) => {
        try {
          const enabled = this.settings.calendars.filter((c) => c.enabled);
          if (!enabled.length) {
            new Notice("No enabled calendars configured.");
            return;
          }

          const events = await this.calendar.fetchEvents();
          const today = new Date().toISOString().slice(0, 10);
          const todaysEvents = events.filter((e) =>
            e.start.startsWith(today)
          );

          const md = [
            `### Events for ${today}`,
            ...todaysEvents.map(
              (e) =>
                `- **${e.subject}** (${e.start} → ${e.end})${e.location ? ` — _${e.location}_` : ""
                }${e.calendarName ? ` — *${e.calendarName}*` : ""}`
            ),
          ].join("\n");

          editor.replaceSelection(md + "\n");
          new Notice(`Inserted ${todaysEvents.length} events.`);
        } catch (e: any) {
          console.error("[OCE] Insert failed:", e);
          new Notice(`Insert failed: ${e?.message || e}`);
        }
      },
    });

    // Toggle sort order
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
        const target =
          todayElement.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top: target, behavior: "smooth" });
        new Notice("Scrolled to Today");
      },
    });

    // -----------------------------
    // SETTINGS TAB
    // -----------------------------
    this.addSettingTab(
      new ObsidianCalendarSettingTab(this.app, this, this.settings, () =>
        this.saveSettings()
      )
    );

    // -----------------------------
    // INITIAL LOAD
    // -----------------------------
    this.app.workspace.onLayoutReady(async () => {
      const leaf = await this.activateView();
      const view = leaf.view as CalendarView;
      view.showLoading();

      const enabledCalendars =
        this.settings.calendars?.filter((c) => c.enabled && c.url.trim()) ?? [];

      if (enabledCalendars.length === 0) {
        console.log("[OCE] No calendars configured — showing setup state.");
        view.setEvents([]);
        new Notice(
          "No calendars configured. Open plugin settings to add one or more calendars."
        );
        return;
      }

      try {
        const events = await this.calendar.fetchEvents();
        view.setEvents(events);
      } catch (err) {
        console.warn("[OCE] Startup fetch failed:", err);
        view.setEvents([]);
        new Notice(
          "Unable to load calendar events. Check your calendar URLs or network connection."
        );
      }
    });
  }

  // -----------------------------
  // RIBBON ICON HANDLING (NEW)
  // -----------------------------
  refreshRibbonIcon() {
    // Remove existing icon if present
    if (this.ribbonEl) {
      this.ribbonEl.detach();
      this.ribbonEl = null;
    }

    // Add new icon only if setting enabled
    if (this.settings.showRibbonIcon) {
      this.ribbonEl = this.addRibbonIcon(
        "calendar", // icon ID
        "Open Calendar Events",
        async () => {
          const leaf = await this.activateView();
          this.app.workspace.revealLeaf(leaf);
        }
      );
    }
  }

  // -----------------------------
  // PLUGIN UNLOAD
  // -----------------------------
  onunload() {
    console.log("[Obsidian Calendar Events] Unloading plugin");

    // Clean up ribbon icon
    if (this.ribbonEl) {
      this.ribbonEl.detach();
      this.ribbonEl = null;
    }

    this.app.workspace.detachLeavesOfType(VIEW_TYPE_SPCALENDAR);
  }

  // -----------------------------
  // VIEW HANDLING
  // -----------------------------
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
    if (!leaf) leaf = await this.activateView();

    const view = leaf.view as CalendarView;
    view.setEvents(events);
  }

  // -----------------------------
  // SETTINGS HANDLING
  // -----------------------------
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

    // Initialize visibility map if missing
    if (!this.settings.visibleCalendars) this.settings.visibleCalendars = {};
    if (!this.settings.collapsedDays) this.settings.collapsedDays = {};

    // Migration from single-calendar format (legacy)
    if ((this.settings as any).icalUrl) {
      const url = (this.settings as any).icalUrl;
      if (url && typeof url === "string" && url.trim().length > 0) {
        console.log("[OCE] Migrating legacy iCal URL to new calendars array.");
        this.settings.calendars = [
          {
            id: "default",
            name: "Primary Calendar",
            url,
            color: "#4A90E2",
            enabled: true,
          },
        ];
        this.settings.visibleCalendars["default"] = true;
      }
      delete (this.settings as any).icalUrl;
      await this.saveSettings();
    }
  }

  async saveSettings() {
    // Optional cleanup: keep only the last 30 days of collapsed states
    const today = new Date().toISOString().slice(0, 10);
    const keepDays = 30;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);

    for (const key in this.settings.collapsedDays) {
      const dayDate = new Date(key);
      if (dayDate < cutoff) delete this.settings.collapsedDays[key];
    }

    await this.saveData(this.settings);
  }
}
