import {App, PluginSettingTab, Setting} from "obsidian";
import CalendarImporterPlugin from "./main";

export interface CalendarImporterSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: CalendarImporterSettings = {
	mySetting: 'default'
}

export class CalendarImporterSettingTab extends PluginSettingTab {
	plugin: CalendarImporterPlugin;

	constructor(app: App, plugin: CalendarImporterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Settings #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
