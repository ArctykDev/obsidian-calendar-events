import { ItemView, WorkspaceLeaf, Notice, TFile, setIcon } from "obsidian";
import moment from "moment";
import {
  getAllDailyNotes,
  getDailyNote,
  createDailyNote,
} from "obsidian-daily-notes-interface";
import type ObsidianCalendarPlugin from "../main";
import type { CalendarEvent } from "../types";

export const VIEW_TYPE_SPCALENDAR = "spcalendar-view";

export class CalendarView extends ItemView {
  private events: CalendarEvent[] = [];
  private plugin: ObsidianCalendarPlugin;
  private lastUpdated: Date | null = null;
  private updateTimer: number | null = null;

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

  getIcon(): string {
    return "calendar-range";
  }

  setEvents(events: CalendarEvent[] | null | undefined) {
    this.events = Array.isArray(events) ? events : [];
    this.lastUpdated = new Date();
    this.render();
  }

  showLoading(message = "Loading calendar events...") {
    const container = this.containerEl;
    container.empty();

    const wrapper = container.createDiv({ cls: "spcalendar-wrapper" });
    const loadingDiv = wrapper.createDiv({ cls: "spcalendar-loading" });
    loadingDiv.style.textAlign = "center";
    loadingDiv.style.padding = "48px";
    loadingDiv.createEl("p", { text: message });
  }


  private render() {
    const container = this.containerEl;
    container.empty();

    if (!this.plugin?.settings) {
      this.showLoading("Initializing...");
      return;
    }

    if (!this.plugin) {
      container.createEl("p", { text: "Plugin context unavailable." });
      return;
    }

    const wrapper = container.createDiv({ cls: "spcalendar-wrapper" });

    // Header
    const header = wrapper.createDiv({ cls: "spcalendar-header" });

    // Left: title + sort toggle
    const leftSection = header.createDiv({ cls: "spcalendar-header-left" });
    leftSection.createSpan({ text: "Calendar Events" });

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
        const icalUrl = this.plugin.settings.icalUrl?.trim();

        // If no calendar configured, skip fetch and show setup message
        if (!icalUrl) {
          this.setEvents([]); // triggers welcome/setup screen
          new Notice("No calendar configured. Open settings to add a calendar.");
          return;
        }

        // Otherwise, show loading spinner and fetch
        this.showLoading("Refreshing events...");
        new Notice("Refreshing calendar...");

        const events = await this.plugin.calendar.fetchEvents();
        this.setEvents(events);

        new Notice("Calendar refreshed.");
      } catch (err) {
        console.error("Error refreshing calendar:", err);
        new Notice("Error refreshing events.");
        this.setEvents([]); // fallback to reset the view
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

    // Date Range & Last Updated
    const isConfigured =
      this.plugin.settings.icalUrl && this.plugin.settings.icalUrl.trim() !== "";

    if (isConfigured) {
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

      // Display dynamic "Last updated" label if available
      if (this.lastUpdated) {
        const updatedDiv = wrapper.createDiv({ cls: "spcalendar-updated" });

        const updateLabel = () => {
          const now = new Date();
          const diffMs = now.getTime() - this.lastUpdated!.getTime();
          const diffMinutes = Math.floor(diffMs / 60000);

          let text = "";
          if (diffMinutes < 1) {
            text = "Updated just now";
          } else if (diffMinutes < 60) {
            text = `Updated ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
          } else if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            text = `Updated ${hours} hour${hours > 1 ? "s" : ""} ago`;
          } else {
            // Hide label after 24 hours
            updatedDiv.empty();
            if (this.updateTimer) {
              window.clearInterval(this.updateTimer);
              this.updateTimer = null;
            }
            return;
          }

          updatedDiv.setText(text);
        };

        updateLabel();

        // Clear any previous interval before starting a new one
        if (this.updateTimer) {
          window.clearInterval(this.updateTimer);
          this.updateTimer = null;
        }

        // Update every 60 seconds
        this.updateTimer = window.setInterval(updateLabel, 60000);
      }
    }

    // === NO EVENTS / FIRST RUN ===
    if (!this.events.length) {
      const isConfigured =
        this.plugin.settings.icalUrl && this.plugin.settings.icalUrl.trim() !== "";

      const emptyState = wrapper.createDiv({ cls: "spcalendar-empty" });
      emptyState.style.textAlign = "center";
      emptyState.style.padding = "48px";

      if (!isConfigured) {
        emptyState.createEl("h3", { text: "Welcome to Obsidian Calendar Events!" });
        emptyState.createEl("p", {
          text: "You haven’t added a calendar source yet. Use the settings icon above or click below to connect your iCal or Outlook calendar.",
        });

        const button = emptyState.createEl("button", { text: "Open Settings" });
        button.classList.add("mod-cta");
        button.style.marginTop = "12px";
        button.onclick = async () => {
          await this.plugin.openSettingsTab();
        };
      } else {
        emptyState.createEl("p", { text: "No upcoming events." });
      }

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

    const sortOrder = this.plugin.settings.sortOrder === "asc" ? 1 : -1;
    const todayKey = moment().format("YYYY-MM-DD");

    // Sort days
    let sortedDays = Object.keys(grouped)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b) * sortOrder);

    // Pin today's events
    if (this.plugin.settings.pinToday) {
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
        ? `Today — ${moment(day).format("dddd, MMMM Do YYYY")}`
        : moment(day).format("dddd, MMMM Do YYYY");

      headerRow.createEl("h3", { text: headerText });
      headerRow.createEl("span", {
        text: `${eventsForDay.length}`,
        cls: "spcalendar-badge",
      });

      if (eventsForDay.length === 0) {
        dayContainer.createEl("p", {
          text: "No events",
          cls: "spcalendar-empty-day",
        });
        continue; // Skip to the next day
      }

      for (const e of eventsForDay) {
        const card = dayContainer.createDiv({ cls: "spcalendar-event" });
        card.createEl("div", {
          text: e.subject || "(no title)",
          cls: "spcalendar-event-title",
        });

        const when = `${moment(e.start).format("h:mm A")} → ${moment(e.end).format(
          "h:mm A"
        )}`;
        const timeRow = card.createDiv({ cls: "spcalendar-row" });
        const timeIcon = timeRow.createSpan({ cls: "spcalendar-icon" });
        setIcon(timeIcon, "clock");
        timeRow.createSpan({ text: `${moment(e.start).format("h:mm A")} → ${moment(e.end).format("h:mm A")}`, cls: "spcalendar-time-text" });

        if (e.location) {
          const locRow = card.createDiv({ cls: "spcalendar-row" });
          const locIcon = locRow.createSpan({ cls: "spcalendar-icon" });
          setIcon(locIcon, "map-pin");
          locRow.createSpan({ text: e.location, cls: "spcalendar-location-text" });
        }

        // Add "Add to Daily Note" icon button
        const addBtn = card.createEl("button", {
          cls: "spcalendar-add-btn hidden",
          attr: { "aria-label": "Add to Daily Note" },
        });
        setIcon(addBtn, "file-plus");
        addBtn.setAttr("title", "Add to Daily Note");

        // Button click handler (stop propagation so it doesn’t trigger card clicks)
        addBtn.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          await this.addEventToDailyNote(e);
        });

        // Show/hide the button on hover
        card.addEventListener("mouseenter", () => {
          addBtn.classList.remove("hidden");
        });
        card.addEventListener("mouseleave", () => {
          addBtn.classList.add("hidden");
        });
      }
    }

    // Auto-scroll to today's section
    if (todayElement) {
      setTimeout(() => {
        todayElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    }
  }

  // Add event to daily note as a Markdown task
  private async addEventToDailyNote(event: CalendarEvent) {
    const app = this.plugin.app;
    const date = moment(event.start).startOf("day");

    try {
      let dailyNote = getDailyNote(date, getAllDailyNotes());
      if (!dailyNote) {
        dailyNote = await createDailyNote(date);
      }

      if (!dailyNote) {
        new Notice("Unable to locate or create the daily note.");
        return;
      }

      const content = await app.vault.read(dailyNote);
      const newTask = `- [ ] ${event.subject} (${moment(event.start).format(
        "h:mm A"
      )} - ${moment(event.end).format("h:mm A")})${event.location ? ` - ${event.location}` : ""
        }`;

      let updatedContent = content;

      if (this.plugin.settings.addUnderHeading) {
        const heading = `## ${this.plugin.settings.headingName}`;
        const headingRegex = new RegExp(
          `^#{1,6}\\s+${this.plugin.settings.headingName}\\s*$`,
          "m"
        );

        if (headingRegex.test(content)) {
          const lines = content.split("\n");
          const index = lines.findIndex((line) => headingRegex.test(line));

          if (index !== -1) {
            if (lines[index + 1]?.trim() !== "") {
              lines.splice(index + 1, 0, "");
            }
            lines.splice(index + 2, 0, newTask);
            updatedContent = lines.join("\n");
          } else {
            updatedContent = `${content.trim()}\n\n${heading}\n\n${newTask}`;
          }
        } else {
          updatedContent = `${content.trim()}\n\n${heading}\n\n${newTask}`;
        }
      } else {
        updatedContent = `${content.trim()}\n${newTask}`;
      }

      await app.vault.modify(dailyNote, updatedContent);
      new Notice(`Added to ${dailyNote.basename} as a task.`);
    } catch (err) {
      console.error("Failed to add event to daily note:", err);
      new Notice("Error adding event to daily note.");
    }
  }
}