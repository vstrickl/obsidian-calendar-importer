import { App, Modal, Notice, Platform, PluginSettingTab, Setting } from 'obsidian';
import CalendarImporterPlugin from './main';
import {
    authenticateGoogleDesktop,
    authenticateGoogleMobile,
    DESKTOP_REDIRECT_URI,
    MOBILE_REDIRECT_URI,
    TokenData,
} from './auth';
import { listCalendars, CalendarInfo } from './calendar';

export interface CalendarImporterSettings {
    // OAuth
    clientId:        string;
    clientSecret:    string;
    accessToken:     string;
    refreshToken:    string;
    tokenExpiresAt:  number;

    // Output
    outputDir: string;

    // Calendar selection (comma-separated names or IDs)
    calendarSelection: string;

    // Cycle defaults
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

        const redirectUri = Platform.isMobile ? MOBILE_REDIRECT_URI : DESKTOP_REDIRECT_URI;

        // Context-sensitive setup instructions
        const instructions = containerEl.createEl('div', { cls: 'setting-item-description' });
        if (Platform.isMobile) {
            instructions.innerHTML =
                '<strong>Mobile setup:</strong> In Google Cloud Console, create an ' +
                '<strong>OAuth 2.0 Web application</strong> credential and add this ' +
                `as an authorized redirect URI:<br><code>${MOBILE_REDIRECT_URI}</code>`;
        } else {
            instructions.innerHTML =
                '<strong>Desktop setup:</strong> In Google Cloud Console, create an ' +
                '<strong>OAuth 2.0 Desktop app</strong> credential. ' +
                'Loopback redirects (<code>127.0.0.1</code>) are automatically allowed ' +
                'for that client type — no manual URI entry needed.';
        }

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

        const authStatus = this.plugin.settings.accessToken ? '✅ Connected' : '❌ Not connected';

        new Setting(containerEl)
            .setName('Connection status')
            .setDesc(authStatus)
            .addButton(btn => btn
                .setButtonText(Platform.isMobile ? 'Connect (opens browser)' : 'Connect Google Account')
                .setCta()
                .onClick(async () => {
                    const { clientId, clientSecret } = this.plugin.settings;
                    if (!clientId || !clientSecret) {
                        new Notice('Enter your Client ID and Client Secret first.');
                        return;
                    }
                    try {
                        btn.setDisabled(true).setButtonText(
                            Platform.isMobile
                                ? 'Switch back to Obsidian after signing in…'
                                : 'Waiting for browser…',
                        );

                        let tokens: TokenData;
                        if (Platform.isMobile) {
                            tokens = await authenticateGoogleMobile(
                                clientId,
                                clientSecret,
                                () => this.plugin.waitForMobileCode(),
                            );
                        } else {
                            tokens = await authenticateGoogleDesktop(clientId, clientSecret);
                        }

                        this.plugin.settings.accessToken    = tokens.access_token;
                        this.plugin.settings.refreshToken   = tokens.refresh_token ?? '';
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

        // Show the active redirect URI so the user can verify it's registered
        new Setting(containerEl)
            .setName('Active redirect URI')
            .setDesc(redirectUri);

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
                    if (!this.plugin.settings.accessToken) {
                        new Notice('Connect your Google account first.');
                        return;
                    }
                    try {
                        const cals = await listCalendars(this.plugin.settings.accessToken);
                        new CalendarListModal(this.app, cals).open();
                    } catch (err) {
                        new Notice(`Failed to fetch calendars: ${(err as Error).message}`);
                    }
                }));

        // ── Cycle defaults ──────────────────────────────────────────────────
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
        this.contentEl.createEl('h2', { text: 'Available Calendars' });
        this.contentEl.createEl('p', { text: 'Copy the names or IDs you want into Calendar Selection.' });
        const ul = this.contentEl.createEl('ul');
        for (const cal of this.calendars) {
            ul.createEl('li', { text: `${cal.summary}  (${cal.id})` });
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
