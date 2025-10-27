import { ItemView, WorkspaceLeaf, Notice, setIcon } from "obsidian";
import moment from "moment";
import type ObsidianCalendarPlugin from "../main";
import type { CalendarEvent } from "../types";

export const VIEW_TYPE_SPCALENDAR = "spcalendar-view";

export class CalendarView extends ItemView {
  private events: CalendarEvent[] = [];
  private plugin: ObsidianCalendarPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: ObsidianCalendarPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_SPCALENDAR;
  }

  getDisplayText() {
    return "Calendar Events";
  }

  setEvents(events: CalendarEvent[] | null | undefined) {
    this.events = Array.isArray(events) ? events : [];
    this.render();
  }

  private render() {
    const container = this.containerEl;
    container.empty();

    if (!this.plugin) {
      container.createEl("p", { text: "Plugin context unavailable." });
      return;
    }

    const wrapper = container.createDiv({ cls: "spcalendar-wrapper" });

    // Header
    const header = wrapper.createDiv({ cls: "spcalendar-header" });

    // Left: title + sort toggle
    const leftSection = header.createDiv({ cls: "spcalendar-header-left" });
    leftSection.createSpan({ text: "Obsidian Calendar Events" });

    const sortIndicator = leftSection.createSpan({
      cls: "spcalendar-sort-indicator",
      text: "▲",
    });

    if (this.plugin.settings.sortOrder === "desc") {
      sortIndicator.classList.add("rotated");
    }

    sortIndicator.addEventListener("click", async () => {
      try {
        const newOrder =
          this.plugin.settings.sortOrder === "asc" ? "desc" : "asc";
        this.plugin.settings.sortOrder = newOrder;
        await this.plugin.saveSettings();

        sortIndicator.classList.toggle("rotated", newOrder === "desc");
        new Notice(`Sort order set to ${newOrder.toUpperCase()}.`);

        const events = await this.plugin.calendar.fetchEvents();
        this.setEvents(events);
      } catch (err) {
        console.error("Error toggling sort:", err);
        new Notice("Error updating sort order.");
      }
    });

    // Right: refresh + settings
    const rightSection = header.createDiv({ cls: "spcalendar-header-right" });

    const refreshBtn = rightSection.createEl("button", {
      cls: "spcalendar-refresh-btn",
      attr: { "aria-label": "Refresh Calendar Events" },
    });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.setAttr("title", "Refresh Calendar Events");
    refreshBtn.addEventListener("click", async () => {
      try {
        new Notice("Refreshing calendar...");
        const events = await this.plugin.calendar.fetchEvents();
        this.setEvents(events);
        new Notice("Calendar refreshed.");
      } catch (err) {
        console.error("Error refreshing calendar:", err);
        new Notice("Error refreshing events.");
      }
    });

    const settingsBtn = rightSection.createEl("button", {
      cls: "spcalendar-settings-btn",
      attr: { "aria-label": "Open Calendar Settings" },
    });
    setIcon(settingsBtn, "settings");
    settingsBtn.setAttr("title", "Open Calendar Settings");
    settingsBtn.addEventListener("click", () => {
      if (this.plugin.openSettingsTab) {
        this.plugin.openSettingsTab();
      } else {
        new Notice("Unable to open settings tab.");
      }
    });

    // Date Range
    const rangeContainer = wrapper.createDiv({ cls: "spcalendar-range" });
    const daysBefore = this.plugin.settings.daysBefore ?? 0;
    const daysAhead = this.plugin.settings.daysAhead ?? 7;

    const start = new Date();
    start.setDate(start.getDate() - daysBefore);
    const end = new Date();
    end.setDate(end.getDate() + daysAhead);

    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    rangeContainer.setText(
      `Showing events from ${formatter.format(start)} → ${formatter.format(end)}`
    );

    // === NO EVENTS ===
    if (!this.events.length) {
      wrapper.createEl("p", { text: "No upcoming events." });
      return;
    }

    // === GROUP BY DAY ===
    const grouped: Record<string, CalendarEvent[]> = {};
    for (const ev of this.events) {
      if (!ev?.start) continue;
      const day = moment(ev.start).isValid()
        ? moment(ev.start).format("YYYY-MM-DD")
        : "unknown";
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(ev);
    }

    const sortOrder =
      this.plugin.settings.sortOrder === "asc" ? 1 : -1;
    const todayKey = moment().format("YYYY-MM-DD");

    // Sort days
    let sortedDays = Object.keys(grouped)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b) * sortOrder);

    // Pin today's events
    if (this.plugin.settings.pinToday) {
      // Ensure todayKey exists even if empty
      if (!grouped[todayKey]) grouped[todayKey] = [];
      const idx = sortedDays.indexOf(todayKey);
      if (idx > -1) sortedDays.splice(idx, 1);
      sortedDays = [todayKey, ...sortedDays];
    }

    let todayElement: HTMLElement | null = null;

    // Render days
    for (const day of sortedDays) {
      const eventsForDay = (grouped[day] ?? []).sort(
        (a, b) => a.start.localeCompare(b.start) * sortOrder
      );

      const isToday = day === todayKey;
      const dayContainer = wrapper.createDiv({
        cls: `spcalendar-day${isToday ? " spcalendar-today" : ""}`,
      });

      if (isToday) todayElement = dayContainer;

      const headerRow = dayContainer.createEl("div", {
        cls: "spcalendar-day-header",
      });

      const headerText = isToday
        ? `📌 Today — ${moment(day).format("dddd, MMMM Do YYYY")}`
        : moment(day).format("dddd, MMMM Do YYYY");

      headerRow.createEl("h3", { text: headerText });
      headerRow.createEl("span", {
        text: `${eventsForDay.length}`,
        cls: "spcalendar-badge",
      });

      for (const e of eventsForDay) {
        const card = dayContainer.createDiv({ cls: "spcalendar-event" });
        card.createEl("div", {
          text: e.subject || "(no title)",
          cls: "spcalendar-event-title",
        });

        const when = `${moment(e.start).format("h:mm A")} → ${moment(e.end).format(
          "h:mm A"
        )}`;
        card.createEl("div", {
          text: `⏰ ${when}`,
          cls: "spcalendar-time",
        });

        if (e.location) {
          card.createEl("div", {
            text: e.location,
            cls: "spcalendar-location",
          });
        }
      }
    }

    // Auto-scroll to today's section
    if (todayElement) {
      setTimeout(() => {
        todayElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    }
  }
}
