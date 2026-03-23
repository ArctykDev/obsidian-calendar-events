import { App, PluginSettingTab, Setting } from "obsidian";
import ObsidianCalendarPlugin from "./main";
import type { ObsidianCalendarSettings } from "./types";

export const DEFAULT_SETTINGS: ObsidianCalendarSettings = {
  calendars: [], // default empty array
  daysBefore: 0,
  daysAhead: 7,
  sortOrder: "asc",
  pinToday: true,
  addUnderHeading: false,
  headingName: "Calendar Events",
  firstRun: true,
  showRibbonIcon: true,
  visibleCalendars: {},
  collapsedDays: {},
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

    // Plugin header with version
    const headerEl = containerEl.createDiv({ cls: "oce-settings-header" });
    headerEl.createEl("h2", { text: "Calendar Events Settings" });

    const versionEl = headerEl.createDiv({ cls: "oce-settings-version" });
    versionEl.createEl("span", {
      text: `v${this.plugin.manifest.version}`,
      cls: "oce-version-badge"
    });

    // Add link to changelog
    const changelogLink = versionEl.createEl("a", {
      text: "Changelog",
      cls: "oce-changelog-link",
      href: "https://github.com/ArctykDev/obsidian-calendar-events/blob/main/CHANGELOG.md"
    });
    changelogLink.setAttribute("target", "_blank");
    changelogLink.setAttribute("rel", "noopener noreferrer");

    // Calendar Sources
    new Setting(containerEl)
      .setName("Calendar sources")
      .setDesc("Manage multiple iCal (.ics) calendar feeds below.");

    const list = containerEl.createDiv();
    (this.settings.calendars ?? []).forEach((cal, i) => {
      const row = new Setting(list)
        .setName(cal.name || `Calendar ${i + 1}`)
        .addText((t) =>
          t
            .setValue(cal.name)
            .setPlaceholder("Calendar name")
            .onChange(async (v) => {
              cal.name = v;
              await this.save();
            })
        )
        .addText((t) =>
          t
            .setPlaceholder("https://example.com/feed.ics")
            .setValue(cal.url)
            .onChange(async (v) => {
              cal.url = v.trim();
              await this.save();
            })
        )
        .addColorPicker((p) =>
          p.setValue(cal.color || "#4A90E2").onChange(async (c) => {
            cal.color = c;
            await this.save();
          })
        )
        .addToggle((t) =>
          t.setValue(cal.enabled).onChange(async (v) => {
            cal.enabled = v;
            await this.save();
          })
        )
        .addExtraButton((btn) =>
          btn
            .setIcon("trash")
            .setTooltip("Remove calendar")
            .onClick(async () => {
              this.settings.calendars.splice(i, 1);
              await this.save();
              this.display();
            })
        );
    });

    new Setting(containerEl)
      .addButton((btn) =>
        btn
          .setButtonText("Add calendar")
          .setCta()
          .onClick(async () => {
            this.settings.calendars.push({
              id: Date.now().toString(),
              name: "New calendar",
              url: "",
              color: "#4A90E2",
              enabled: true,
            });
            await this.save();
            this.display();
          })
      );

    // Add spacing for readability
    containerEl.createEl("hr");

    // Days before today
    new Setting(containerEl)
      .setName("Days before today")
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
      .setName("Days after today")
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
      .setName("Sort order")
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
      .setName("Pin today's events")
      .setDesc("Always show today's events at the top, regardless of sort order")
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.pinToday)
          .onChange(async (value) => {
            this.settings.pinToday = value;
            await this.save();
          })
      );

    // Add events under heading
    new Setting(containerEl)
      .setName("Add events under heading")
      .setDesc(
        "If enabled, events will be added under a specific heading in the daily note."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.addUnderHeading)
          .onChange(async (value) => {
            this.settings.addUnderHeading = value;
            await this.save();
            this.display(); // re-render to show or hide heading name field
          })
      );

    // Heading name (only visible if toggle is enabled)
    if (this.settings.addUnderHeading) {
      new Setting(containerEl)
        .setName("Heading name")
        .setDesc("The heading under which events will be added in the daily note.")
        .addText((text) =>
          text
            .setPlaceholder("Calendar Events")
            .setValue(this.settings.headingName)
            .onChange(async (value) => {
              this.settings.headingName = value.trim() || "Calendar Events";
              await this.save();
            })
        );
    }

    new Setting(containerEl)
      .setName("Show ribbon icon")
      .setDesc("Adds a calendar icon to the Obsidian ribbon for quick access.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.showRibbonIcon ?? true)
          .onChange(async (value) => {
            this.settings.showRibbonIcon = value;
            await this.save();
            this.plugin.refreshRibbonIcon();
          })
      );

    // -----------------------------------------------------------------------
    // Support Section
    // -----------------------------------------------------------------------
    containerEl.createEl("hr", { attr: { style: "margin: 32px 0 24px 0;" } });
    
    new Setting(containerEl).setName("Support development").setHeading();
    
    new Setting(containerEl)
      .setName("Documentation & updates")
      .setDesc("Visit GitHub for documentation, changelog, and updates")
      .addButton((btn) => {
        btn
          .setButtonText("Visit GitHub")
          .onClick(() => {
            window.open("https://github.com/ArctykDev/obsidian-calendar-events", "_blank");
          });
      });
    
    const coffeeSetting = new Setting(containerEl)
      .setName("Buy me a coffee")
      .setDesc("If you find this plugin useful, consider supporting development!");
    
    // Add Buy Me a Coffee button in the same row
    const coffeeLink = coffeeSetting.controlEl.createEl("a", {
      href: "https://www.buymeacoffee.com/arctykdev"
    });
    coffeeLink.setAttribute("target", "_blank");
    coffeeLink.setAttribute("rel", "noopener noreferrer");
    
    const coffeeImg = coffeeLink.createEl("img", {
      attr: {
        src: "https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png",
        alt: "Buy Me A Coffee"
      }
    });
    coffeeImg.style.height = "40px";
    coffeeImg.style.width = "145px";
    coffeeImg.style.verticalAlign = "middle";
  }
}
