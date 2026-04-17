import { App, Modal, Notice, Plugin, Setting } from 'obsidian';
import { DEFAULT_SETTINGS, CalendarImporterSettings, CalendarImporterSettingTab } from './settings';
import { runSchedule, RunOptions } from './runner';

export default class CalendarImporterPlugin extends Plugin {
    settings!: CalendarImporterSettings;

    async onload() {
        await this.loadSettings();

        this.addRibbonIcon('calendar-days', 'Import Calendar Schedule', () => {
            this.openImportModal();
        });

        this.addCommand({
            id: 'import-calendar-schedule',
            name: 'Import calendar schedule',
            callback: () => this.openImportModal(),
        });

        this.addSettingTab(new CalendarImporterSettingTab(this.app, this));
    }

    onunload() {}

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<CalendarImporterSettings>);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private openImportModal() {
        if (!this.settings.accessToken) {
            new Notice('Connect your Google account first (Settings → Calendar Importer Sync).');
            return;
        }
        new ImportModal(this.app, this).open();
    }
}

class ImportModal extends Modal {
    plugin: CalendarImporterPlugin;

    constructor(app: App, plugin: CalendarImporterPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Import Calendar Schedule' });

        const s = this.plugin.settings;

        // Local state (pre-filled from settings defaults)
        let startDate    = '';
        let endDate      = '';
        let phase        = s.defaultCyclePhase;
        let outputMode   = s.defaultOutputMode;
        let mondayCd     = s.defaultMondayCycleDay;
        let cycleLength  = s.defaultCycleLength;

        new Setting(contentEl)
            .setName('Start date')
            .setDesc('Monday of the week to import (YYYY-MM-DD).')
            .addText(t => t
                .setPlaceholder('2026-02-23')
                .onChange(v => { startDate = v.trim(); }));

        new Setting(contentEl)
            .setName('End date')
            .setDesc('Sunday of the week to import (YYYY-MM-DD).')
            .addText(t => t
                .setPlaceholder('2026-03-01')
                .onChange(v => { endDate = v.trim(); }));

        new Setting(contentEl)
            .setName('Cycle phase')
            .addDropdown(d => d
                .addOption('1_Follicular', '1 – Follicular')
                .addOption('2_Ovulatory',  '2 – Ovulatory')
                .addOption('3_Luteal',     '3 – Luteal')
                .addOption('4_Deload',     '4 – Deload')
                .setValue(phase)
                .onChange(v => { phase = v; }));

        new Setting(contentEl)
            .setName('Output mode')
            .addDropdown(d => d
                .addOption('1', 'Combined weekly file')
                .addOption('2', 'One file per day')
                .setValue(outputMode)
                .onChange(v => { outputMode = v as '1' | '2'; }));

        new Setting(contentEl)
            .setName('Monday cycle day')
            .setDesc('Cycle day that falls on the Monday of this week.')
            .addText(t => t
                .setValue(String(mondayCd))
                .onChange(v => {
                    const n = parseInt(v);
                    if (!isNaN(n) && n > 0) mondayCd = n;
                }));

        new Setting(contentEl)
            .setName('Cycle length (days)')
            .addText(t => t
                .setValue(String(cycleLength))
                .onChange(v => {
                    const n = parseInt(v);
                    if (!isNaN(n) && n > 0) cycleLength = n;
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Import')
                .setCta()
                .onClick(async () => {
                    if (!startDate || !endDate) {
                        new Notice('Enter both a start date and an end date.');
                        return;
                    }
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
                        new Notice('Dates must be in YYYY-MM-DD format.');
                        return;
                    }

                    btn.setDisabled(true).setButtonText('Importing…');
                    this.close();

                    const opts: RunOptions = {
                        startDate,
                        endDate,
                        phase,
                        outputMode,
                        mondayCycleDay: mondayCd,
                        cycleLength,
                    };

                    try {
                        const result = await runSchedule(this.app, this.plugin, opts);
                        if (result.noEventDays.length > 0) {
                            new Notice(`Import complete. No events on: ${result.noEventDays.join(', ')}`);
                        } else {
                            new Notice('Import complete.');
                        }
                    } catch (err) {
                        new Notice(`Import failed: ${(err as Error).message}`);
                    }
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}
