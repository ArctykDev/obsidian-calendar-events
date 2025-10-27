import { App, PluginSettingTab, Setting } from "obsidian";
import ObsidianCalendarPlugin from "./main";
import type { ObsidianCalendarSettings } from "./types";

export const DEFAULT_SETTINGS: ObsidianCalendarSettings = {
  icalUrl: "",
  daysBefore: 0,
  daysAhead: 7,
  sortOrder: "asc",
  pinToday: true,
};

export class ObsidianCalendarSettingTab extends PluginSettingTab {
  plugin: ObsidianCalendarPlugin;
  settings: ObsidianCalendarSettings;
  save: () => Promise<void>;

  constructor(
    app: App,
    plugin: ObsidianCalendarPlugin,
    settings: ObsidianCalendarSettings,
    save: () => Promise<void>
  ) {
    super(app, plugin);
    this.plugin = plugin;
    this.settings = settings;
    this.save = save;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Obsidian Calendar Events Settings" });

    // iCal URL field
    new Setting(containerEl)
      .setName("iCal URL")
      .setDesc("Paste a public or shared .ics calendar link")
      .addText((text) =>
        text
          .setPlaceholder("https://example.com/calendar.ics")
          .setValue(this.settings.icalUrl || "")
          .onChange(async (value) => {
            this.settings.icalUrl = value.trim();
            await this.save();
          })
      );

    // Days before today
    new Setting(containerEl)
      .setName("Days Before Today")
      .setDesc("Number of days before today to include in the calendar view")
      .addText((text) =>
        text
          .setPlaceholder("0")
          .setValue(this.settings.daysBefore.toString())
          .onChange(async (value) => {
            const parsed = parseInt(value) || 0;
            this.settings.daysBefore = Math.max(parsed, 0);
            await this.save();
          })
      );

    // Days after today
    new Setting(containerEl)
      .setName("Days After Today")
      .setDesc("Number of days after today to include in the calendar view")
      .addText((text) =>
        text
          .setPlaceholder("7")
          .setValue(this.settings.daysAhead.toString())
          .onChange(async (value) => {
            const parsed = parseInt(value) || 7;
            this.settings.daysAhead = Math.max(parsed, 0);
            await this.save();
          })
      );

    // Sort order
    new Setting(containerEl)
      .setName("Sort Order")
      .setDesc("Choose whether to show events in ascending or descending order")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("asc", "Ascending (Earliest first)")
          .addOption("desc", "Descending (Latest first)")
          .setValue(this.settings.sortOrder)
          .onChange(async (value) => {
            this.settings.sortOrder = value as "asc" | "desc";
            await this.save();
          })
      );

    // Pin today's events
    new Setting(containerEl)
      .setName("Pin Today's Events")
      .setDesc("Always show today's events at the top, regardless of sort order")
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.pinToday)
          .onChange(async (value) => {
            this.settings.pinToday = value;
            await this.save();
          })
      );
  }
}
