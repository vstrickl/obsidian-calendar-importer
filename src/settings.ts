import { App, Modal, Notice, PluginSettingTab, Setting } from 'obsidian';
import CalendarImporterPlugin from './main';
import { authenticateGoogle } from './auth';
import { listCalendars, CalendarInfo } from './calendar';

export interface CalendarImporterSettings {
    // OAuth
    clientId:        string;
    clientSecret:    string;
    accessToken:     string;
    refreshToken:    string;
    tokenExpiresAt:  number;

    // Output
    outputDir:       string;  // relative to vault root, e.g. "schedule/by_cycle"

    // Calendar selection (comma-separated names or IDs)
    calendarSelection: string;

    // Cycle defaults (pre-fill the import modal)
    defaultCycleLength:    number;
    defaultMondayCycleDay: number;
    defaultCyclePhase:     string;
    defaultOutputMode:     '1' | '2';
}

export const DEFAULT_SETTINGS: CalendarImporterSettings = {
    clientId:        '',
    clientSecret:    '',
    accessToken:     '',
    refreshToken:    '',
    tokenExpiresAt:  0,
    outputDir:       'schedule/by_cycle',
    calendarSelection: '',
    defaultCycleLength:    28,
    defaultMondayCycleDay: 1,
    defaultCyclePhase:     '1_Follicular',
    defaultOutputMode:     '1',
};

export class CalendarImporterSettingTab extends PluginSettingTab {
    plugin: CalendarImporterPlugin;

    constructor(app: App, plugin: CalendarImporterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // ── Google OAuth ────────────────────────────────────────────────────
        containerEl.createEl('h2', { text: 'Google Account' });

        new Setting(containerEl)
            .setName('OAuth Client ID')
            .setDesc('From Google Cloud Console → APIs & Services → Credentials.')
            .addText(t => t
                .setPlaceholder('your-client-id.apps.googleusercontent.com')
                .setValue(this.plugin.settings.clientId)
                .onChange(async v => {
                    this.plugin.settings.clientId = v.trim();
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('OAuth Client Secret')
            .addText(t => {
                t.inputEl.type = 'password';
                t.setValue(this.plugin.settings.clientSecret)
                    .onChange(async v => {
                        this.plugin.settings.clientSecret = v.trim();
                        await this.plugin.saveSettings();
                    });
            });

        const authStatus = this.plugin.settings.accessToken
            ? '✅ Connected'
            : '❌ Not connected';

        new Setting(containerEl)
            .setName('Connection status')
            .setDesc(authStatus)
            .addButton(btn => btn
                .setButtonText('Connect Google Account')
                .setCta()
                .onClick(async () => {
                    const { clientId, clientSecret } = this.plugin.settings;
                    if (!clientId || !clientSecret) {
                        new Notice('Enter your Client ID and Client Secret first.');
                        return;
                    }
                    try {
                        btn.setDisabled(true).setButtonText('Waiting for browser…');
                        const tokens = await authenticateGoogle(clientId, clientSecret);
                        this.plugin.settings.accessToken   = tokens.access_token;
                        this.plugin.settings.refreshToken  = tokens.refresh_token ?? '';
                        this.plugin.settings.tokenExpiresAt = tokens.expires_at ?? 0;
                        await this.plugin.saveSettings();
                        new Notice('Google account connected!');
                        this.display();
                    } catch (err) {
                        new Notice(`Authentication failed: ${(err as Error).message}`);
                        btn.setDisabled(false).setButtonText('Connect Google Account');
                    }
                }))
            .addButton(btn => btn
                .setButtonText('Disconnect')
                .onClick(async () => {
                    this.plugin.settings.accessToken    = '';
                    this.plugin.settings.refreshToken   = '';
                    this.plugin.settings.tokenExpiresAt = 0;
                    await this.plugin.saveSettings();
                    new Notice('Disconnected from Google.');
                    this.display();
                }));

        // ── Output ──────────────────────────────────────────────────────────
        containerEl.createEl('h2', { text: 'Output' });

        new Setting(containerEl)
            .setName('Output directory')
            .setDesc('Relative to vault root. Phase subfolders are created automatically.')
            .addText(t => t
                .setPlaceholder('schedule/by_cycle')
                .setValue(this.plugin.settings.outputDir)
                .onChange(async v => {
                    this.plugin.settings.outputDir = v.trim() || 'schedule/by_cycle';
                    await this.plugin.saveSettings();
                }));

        // ── Calendars ────────────────────────────────────────────────────────
        containerEl.createEl('h2', { text: 'Calendars' });

        new Setting(containerEl)
            .setName('Calendar selection')
            .setDesc('Comma-separated calendar names or IDs to include.')
            .addTextArea(t => t
                .setPlaceholder('Job Meetings, Nutrition, Hair & Beauty, …')
                .setValue(this.plugin.settings.calendarSelection)
                .onChange(async v => {
                    this.plugin.settings.calendarSelection = v;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Browse available calendars')
            .setDesc('Lists all calendars on your Google account.')
            .addButton(btn => btn
                .setButtonText('Browse calendars')
                .onClick(async () => {
                    const { accessToken } = this.plugin.settings;
                    if (!accessToken) {
                        new Notice('Connect your Google account first.');
                        return;
                    }
                    try {
                        const cals = await listCalendars(accessToken);
                        new CalendarListModal(this.app, cals).open();
                    } catch (err) {
                        new Notice(`Failed to fetch calendars: ${(err as Error).message}`);
                    }
                }));

        // ── Cycle defaults ────────────────────────────────────────────────
        containerEl.createEl('h2', { text: 'Cycle defaults' });

        new Setting(containerEl)
            .setName('Default cycle length (days)')
            .addText(t => t
                .setValue(String(this.plugin.settings.defaultCycleLength))
                .onChange(async v => {
                    const n = parseInt(v);
                    if (!isNaN(n) && n > 0) {
                        this.plugin.settings.defaultCycleLength = n;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Default Monday cycle day')
            .setDesc('The cycle day that falls on the Monday of the import week.')
            .addText(t => t
                .setValue(String(this.plugin.settings.defaultMondayCycleDay))
                .onChange(async v => {
                    const n = parseInt(v);
                    if (!isNaN(n) && n > 0) {
                        this.plugin.settings.defaultMondayCycleDay = n;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Default cycle phase')
            .addDropdown(d => d
                .addOption('1_Follicular', '1 – Follicular')
                .addOption('2_Ovulatory',  '2 – Ovulatory')
                .addOption('3_Luteal',     '3 – Luteal')
                .addOption('4_Deload',     '4 – Deload')
                .setValue(this.plugin.settings.defaultCyclePhase)
                .onChange(async v => {
                    this.plugin.settings.defaultCyclePhase = v;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default output mode')
            .addDropdown(d => d
                .addOption('1', 'Combined weekly file')
                .addOption('2', 'One file per day')
                .setValue(this.plugin.settings.defaultOutputMode)
                .onChange(async v => {
                    this.plugin.settings.defaultOutputMode = v as '1' | '2';
                    await this.plugin.saveSettings();
                }));
    }
}

class CalendarListModal extends Modal {
    calendars: CalendarInfo[];

    constructor(app: App, calendars: CalendarInfo[]) {
        super(app);
        this.calendars = calendars;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Available Calendars' });
        contentEl.createEl('p', { text: 'Copy the names or IDs you want into Calendar Selection.' });

        const ul = contentEl.createEl('ul');
        for (const cal of this.calendars) {
            ul.createEl('li', { text: `${cal.summary}  (${cal.id})` });
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
