import { ItemView, WorkspaceLeaf, Notice, setIcon } from "obsidian";
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
  private visibleCalendars: Record<string, boolean> = {};
  private events: CalendarEvent[] = [];
  private plugin: ObsidianCalendarPlugin;
  private lastUpdated: Date | null = null;
  private updateTimer: number | null = null;
  private collapsedDays: Record<string, boolean> = {};

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
  
    // Sync visible calendar states
    this.visibleCalendars = { ...this.plugin.settings.visibleCalendars };
    // Sync collapsed days from settings
    this.collapsedDays = { ...this.plugin.settings.collapsedDays };

    // Initialize visible states for all calendars if not yet defined
    for (const cal of this.plugin.settings.calendars ?? []) {
      if (!(cal.id in this.visibleCalendars)) {
        this.visibleCalendars[cal.id] = true;
      }
    }
  
    this.plugin.settings.visibleCalendars = this.visibleCalendars;
    this.plugin.saveSettings();

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

    const wrapper = container.createDiv({ cls: "spcalendar-wrapper" });

    // HEADER BAR ---------------------------------------------------
    const header = wrapper.createDiv({ cls: "spcalendar-header" });

    // Calendar visibility toggles
    const enabledCalendars = this.plugin.settings.calendars?.filter((c) => c.enabled) ?? [];
    if (enabledCalendars.length > 1) {
      const toggleBar = wrapper.createDiv({ cls: "spcalendar-togglebar" });
      toggleBar.style.display = "flex";
      toggleBar.style.flexWrap = "wrap";
      toggleBar.style.gap = "8px";
      toggleBar.style.marginBottom = "10px";
      toggleBar.style.padding = "4px 0";
      toggleBar.style.justifyContent = "center";
    
      for (const cal of enabledCalendars) {
        const isVisible = this.visibleCalendars[cal.id] ?? true;
    
        const toggle = toggleBar.createEl("button", { text: cal.name });
        toggle.style.border = "1px solid var(--background-modifier-border)";
        toggle.style.borderRadius = "6px";
        toggle.style.padding = "4px 10px";
        toggle.style.cursor = "pointer";
        toggle.style.transition = "all 0.2s ease";
        toggle.style.backgroundColor = isVisible
          ? cal.color || "var(--interactive-accent)"
          : "var(--background-secondary)";
        toggle.style.color = isVisible ? "#fff" : "var(--text-muted)";
    
        toggle.onclick = async () => {
          // Toggle visibility and persist immediately
          this.visibleCalendars[cal.id] = !isVisible;
          this.plugin.settings.visibleCalendars = this.visibleCalendars;
          await this.plugin.saveSettings();
          this.render(); // Re-render the view with updated visibility
        };
      }
    }
    


    // Left: Title + Sort
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

    // Right: Refresh + Settings
    const rightSection = header.createDiv({ cls: "spcalendar-header-right" });

    const refreshBtn = rightSection.createEl("button", {
      cls: "spcalendar-refresh-btn",
      attr: { "aria-label": "Refresh Calendar Events" },
    });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.setAttr("title", "Refresh Calendar Events");

    refreshBtn.addEventListener("click", async () => {
      try {
        const enabledCalendars =
          this.plugin.settings.calendars?.filter((c) => c.enabled) ?? [];

        if (enabledCalendars.length === 0) {
          this.setEvents([]);
          new Notice("No enabled calendars. Open settings to add one.");
          return;
        }

        this.showLoading("Refreshing events...");
        new Notice("Refreshing calendar...");

        const events = await this.plugin.calendar.fetchEvents();
        this.setEvents(events);
        new Notice("Calendar refreshed.");
      } catch (err) {
        console.error("Error refreshing calendar:", err);
        new Notice("Error refreshing events.");
        this.setEvents([]);
      }
    });

    // Collapse/Expand All button
    const toggleCollapseBtn = rightSection.createEl("button", {
      cls: "spcalendar-collapseall-btn",
      attr: { "aria-label": "Collapse or Expand All Days" },
    });
    
    // Set initial icon based on state
    const allCollapsed = Object.values(this.collapsedDays).length > 0 &&
      Object.values(this.collapsedDays).every((v) => v === true);
    
    setIcon(toggleCollapseBtn, allCollapsed ? "chevrons-up" : "chevrons-down");
    toggleCollapseBtn.setAttr(
      "title",
      allCollapsed ? "Expand All Days" : "Collapse All Days"
    );
    
    toggleCollapseBtn.addEventListener("click", async () => {
      const currentlyCollapsed =
        Object.values(this.collapsedDays).length > 0 &&
        Object.values(this.collapsedDays).every((v) => v === true);
    
      // If all collapsed, expand all; otherwise collapse all
      const newState = !currentlyCollapsed;
    
      // Apply new state to all days present in this view
      const allDays = [
        ...new Set(Object.keys(this.collapsedDays).concat(Object.keys(grouped))),
      ];
      for (const day of allDays) {
        this.collapsedDays[day] = newState;
      }
    
      // Persist changes
      this.plugin.settings.collapsedDays = this.collapsedDays;
      await this.plugin.saveSettings();
    
      // Update button icon and label dynamically
      setIcon(toggleCollapseBtn, newState ? "chevrons-up" : "chevrons-down");
      toggleCollapseBtn.setAttr(
        "title",
        newState ? "Expand All Days" : "Collapse All Days"
      );
    
      new Notice(newState ? "Collapsed all days" : "Expanded all days");
      this.render();
    });
    

    const settingsBtn = rightSection.createEl("button", {
      cls: "spcalendar-settings-btn",
      attr: { "aria-label": "Open Calendar Settings" },
    });
    setIcon(settingsBtn, "settings");
    settingsBtn.setAttr("title", "Open Calendar Settings");
    settingsBtn.addEventListener("click", () => this.plugin.openSettingsTab());

    // RANGE LABEL ---------------------------------------------------
    const calendarsConfigured =
      this.plugin.settings.calendars?.filter((c) => c.enabled).length > 0;

    if (calendarsConfigured) {
      const rangeContainer = wrapper.createDiv({ cls: "spcalendar-range" });
      const { daysBefore = 0, daysAhead = 7 } = this.plugin.settings;
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

      if (this.lastUpdated) {
        const updatedDiv = wrapper.createDiv({ cls: "spcalendar-updated" });
        const updateLabel = () => {
          const now = new Date();
          const diffMs = now.getTime() - this.lastUpdated!.getTime();
          const diffMinutes = Math.floor(diffMs / 60000);
          let text = "";

          if (diffMinutes < 1) text = "Updated just now";
          else if (diffMinutes < 60)
            text = `Updated ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
          else if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            text = `Updated ${hours} hour${hours > 1 ? "s" : ""} ago`;
          } else {
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

        if (this.updateTimer) {
          window.clearInterval(this.updateTimer);
        }
        this.updateTimer = window.setInterval(updateLabel, 60000);
      }

    }

    // EMPTY STATE ---------------------------------------------------
    if (!this.events.length) {
      const empty = wrapper.createDiv({ cls: "spcalendar-empty" });
      empty.style.textAlign = "center";
      empty.style.padding = "48px";

      if (!calendarsConfigured) {
        empty.createEl("h3", { text: "Welcome to Obsidian Calendar Events!" });
        empty.createEl("p", {
          text: "No calendars are configured. Use the settings icon above to add one or click below to open settings.",
        });
        const button = empty.createEl("button", { text: "Open Settings" });
        button.classList.add("mod-cta");
        button.style.marginTop = "12px";
        button.onclick = async () => this.plugin.openSettingsTab();
      } else {
        empty.createEl("p", { text: "No upcoming events." });
      }
      return;
    }

    // GROUP BY DAY ---------------------------------------------------
    const grouped: Record<string, CalendarEvent[]> = {};
    for (const ev of this.events) {
      if (ev.calendarId && this.visibleCalendars[ev.calendarId] === false) continue;    
      if (!ev?.start) continue;
      const day = moment(ev.start).isValid()
        ? moment(ev.start).format("YYYY-MM-DD")
        : "unknown";
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(ev);
    }

    const sortOrder = this.plugin.settings.sortOrder === "asc" ? 1 : -1;
    const todayKey = moment().format("YYYY-MM-DD");

    let sortedDays = Object.keys(grouped)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b) * sortOrder);

    if (this.plugin.settings.pinToday) {
      const idx = sortedDays.indexOf(todayKey);
      if (idx > -1) sortedDays.splice(idx, 1);
      sortedDays = [todayKey, ...sortedDays];
    }

    let todayElement: HTMLElement | null = null;

    // RENDER DAYS ---------------------------------------------------
    for (const day of sortedDays) {
      const eventsForDay = (grouped[day] ?? []).sort(
        (a, b) => a.start.localeCompare(b.start) * sortOrder
      );
    
      const isToday = day === todayKey;
      const dayContainer = wrapper.createDiv({
        cls: `spcalendar-day${isToday ? " spcalendar-today" : ""}`,
      });
    
      if (isToday) todayElement = dayContainer;
    
      // Header row (clickable for expand/collapse)
      const headerRow = dayContainer.createDiv({ cls: "spcalendar-day-header" });
      const headerText = isToday
        ? `Today — ${moment(day).format("dddd, MMMM Do YYYY")}`
        : moment(day).format("dddd, MMMM Do YYYY");
    
      const headerLabel = headerRow.createEl("h3", { text: headerText });
      const badge = headerRow.createEl("span", {
        text: `${eventsForDay.length}`,
        cls: "spcalendar-badge",
      });
    
      // Expand/Collapse indicator
      const toggleIcon = headerRow.createSpan({ cls: "spcalendar-collapse-icon" });
      toggleIcon.textContent = this.collapsedDays[day] ? "▶" : "▼";
      toggleIcon.style.marginLeft = "8px";
      toggleIcon.style.cursor = "pointer";
    
      // Clickable header area to toggle
      headerRow.addEventListener("click", async () => {
        this.collapsedDays[day] = !this.collapsedDays[day];
        this.plugin.settings.collapsedDays = this.collapsedDays;
        await this.plugin.saveSettings();
        this.render();
      });
      
    
      // Container for events
      const eventContainer = dayContainer.createDiv({ cls: "spcalendar-events" });
      eventContainer.style.display = this.collapsedDays[day] ? "none" : "block";
    
      if (eventsForDay.length === 0) {
        eventContainer.createEl("p", {
          text: "No events",
          cls: "spcalendar-empty-day",
        });
        continue;
      }
    
      for (const e of eventsForDay) {
        const card = eventContainer.createDiv({ cls: "spcalendar-event" });
        if (e.color) card.style.borderLeft = `4px solid ${e.color}`;
        card.createEl("div", {
          text: e.subject || "(no title)",
          cls: "spcalendar-event-title",
        });
    
        const timeRow = card.createDiv({ cls: "spcalendar-row" });
        const timeIcon = timeRow.createSpan({ cls: "spcalendar-icon" });
        setIcon(timeIcon, "clock");
        timeRow.createSpan({
          text: `${moment(e.start).format("h:mm A")} → ${moment(e.end).format(
            "h:mm A"
          )}`,
          cls: "spcalendar-time-text",
        });
    
        if (e.location) {
          const locRow = card.createDiv({ cls: "spcalendar-row" });
          const locIcon = locRow.createSpan({ cls: "spcalendar-icon" });
          setIcon(locIcon, "map-pin");
          locRow.createSpan({
            text: e.location,
            cls: "spcalendar-location-text",
          });
        }
    
        // Optional calendar label
        if (e.calendarName) {
          const source = card.createDiv({ cls: "spcalendar-row" });
          const dot = source.createSpan();
          dot.style.width = "10px";
          dot.style.height = "10px";
          dot.style.borderRadius = "50%";
          dot.style.backgroundColor = e.color || "#4A90E2";
          source.createSpan({
            text: e.calendarName,
            cls: "spcalendar-calendar-name",
          });
        }
    
        const addBtn = card.createEl("button", {
          cls: "spcalendar-add-btn hidden",
          attr: { "aria-label": "Add to Daily Note" },
        });
        setIcon(addBtn, "file-plus");
        addBtn.setAttr("title", "Add to Daily Note");
    
        addBtn.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          await this.addEventToDailyNote(e);
        });
    
        card.addEventListener("mouseenter", () => {
          addBtn.classList.remove("hidden");
        });
        card.addEventListener("mouseleave", () => {
          addBtn.classList.add("hidden");
        });
      }
    }
    

    if (todayElement) {
      setTimeout(() => {
        todayElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    }
  }

  // Add event to daily note
  private async addEventToDailyNote(event: CalendarEvent) {
    const app = this.plugin.app;
    const date = moment(event.start).startOf("day");

    try {
      let dailyNote = getDailyNote(date, getAllDailyNotes());
      if (!dailyNote) dailyNote = await createDailyNote(date);
      if (!dailyNote) {
        new Notice("Unable to locate or create the daily note.");
        return;
      }

      const content = await app.vault.read(dailyNote);
      const newTask = `- [ ] ${event.subject} (${moment(event.start).format(
        "h:mm A"
      )} - ${moment(event.end).format("h:mm A")})${
        event.location ? ` - ${event.location}` : ""
      }`;

      let updated = content.trim();
      if (this.plugin.settings.addUnderHeading) {
        const heading = `## ${this.plugin.settings.headingName}`;
        const headingRegex = new RegExp(`^#{1,6}\\s+${this.plugin.settings.headingName}\\s*$`, "m");
        if (headingRegex.test(content)) {
          const lines = content.split("\n");
          const index = lines.findIndex((line) => headingRegex.test(line));
          lines.splice(index + 1, 0, "", newTask);
          updated = lines.join("\n");
        } else {
          updated += `\n\n${heading}\n\n${newTask}`;
        }
      } else {
        updated += `\n${newTask}`;
      }

      await app.vault.modify(dailyNote, updated);
      new Notice(`Added to ${dailyNote.basename} as a task.`);
    } catch (err) {
      console.error("Failed to add event to daily note:", err);
      new Notice("Error adding event to daily note.");
    }
  }
}
