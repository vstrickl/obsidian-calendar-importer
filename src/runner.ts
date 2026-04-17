import { App, Notice } from 'obsidian';
import { CalendarImporterSettings } from './settings';
import { refreshAccessToken, TokenData } from './auth';
import { listCalendars, fetchDayEvents, resolveCalendars, CalendarEvent } from './calendar';
import { TIME_BLOCKS, expandEventToBlockKeys, midnightInLA } from './timeblocks';
import {
    DAYS, DayName,
    buildWeekdayCdMap, computeWeekRange,
    generateCombinedTable, buildDayHeading,
    WEEKDAY_FILE_PREFIX,
} from './render';

export interface RunOptions {
    startDate: string;   // "YYYY-MM-DD"
    endDate:   string;   // "YYYY-MM-DD"
    phase:     string;   // e.g. "3_Luteal"
    outputMode: '1' | '2';  // "1" = combined, "2" = per-day
    mondayCycleDay: number;
    cycleLength:    number;
}

async function ensureValidToken(plugin: { settings: CalendarImporterSettings; saveSettings(): Promise<void> }): Promise<string> {
    const s = plugin.settings;
    const isExpired = !s.tokenExpiresAt || Date.now() >= s.tokenExpiresAt - 60_000;

    if (isExpired && s.refreshToken) {
        const refreshed: TokenData = await refreshAccessToken(s.clientId, s.clientSecret, s.refreshToken);
        s.accessToken    = refreshed.access_token;
        s.tokenExpiresAt = refreshed.expires_at ?? 0;
        await plugin.saveSettings();
    }

    if (!s.accessToken) throw new Error('Not authenticated. Please connect your Google account in settings.');
    return s.accessToken;
}

export async function runSchedule(
    app: App,
    plugin: { settings: CalendarImporterSettings; saveSettings(): Promise<void> },
    opts: RunOptions,
): Promise<{ noEventDays: string[] }> {
    const accessToken = await ensureValidToken(plugin);
    const { settings } = plugin;

    // Resolve calendar selection → [{id, summary}]
    const allCalendars = await listCalendars(accessToken);
    const tokens = settings.calendarSelection.split(',').map(t => t.trim()).filter(Boolean);
    const selectedCalendars = resolveCalendars(allCalendars, tokens);

    if (selectedCalendars.length === 0) {
        throw new Error('No matching calendars found. Check your Calendar Selection in settings.');
    }

    const weekdayCdMap = buildWeekdayCdMap(opts.mondayCycleDay, opts.cycleLength);
    const endCd = ((opts.mondayCycleDay - 1 + 6) % opts.cycleLength) + 1;

    const noEventDays: string[] = [];
    const eventsByDay: Partial<Record<DayName, Record<string, string>>> = {};

    // Iterate each day in range
    let cursor = new Date(opts.startDate + 'T12:00:00Z'); // noon UTC for date math
    const endDateMs = new Date(opts.endDate + 'T12:00:00Z').getTime();

    while (cursor.getTime() <= endDateMs) {
        const dateStr = cursor.toISOString().slice(0, 10);
        const dayStartUtc = midnightInLA(dateStr);

        // Fetch from all selected calendars
        const allEvents: CalendarEvent[] = [];
        for (const cal of selectedCalendars) {
            const events = await fetchDayEvents(accessToken, cal.id, dayStartUtc);
            allEvents.push(...events);
        }

        if (allEvents.length === 0) {
            noEventDays.push(dateStr);
            cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
            continue;
        }

        // Build time-block map for this day
        const timeBlocks: Record<string, string> = {};
        for (const block of TIME_BLOCKS) timeBlocks[block] = '';

        for (const event of allEvents) {
            const startDt = event.start.dateTime;
            const endDt   = event.end.dateTime;
            if (!startDt || !endDt) continue; // skip all-day events

            const summary = event.summary ?? 'Untitled';
            for (const key of expandEventToBlockKeys(startDt, endDt)) {
                if (!(key in timeBlocks)) continue;
                timeBlocks[key] = timeBlocks[key] ? `${timeBlocks[key]}, ${summary}` : summary;
            }
        }

        // weekday: 0=Sun … 6=Sat; DAYS is Mon-indexed
        const jsDay = cursor.getUTCDay();
        const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
        const weekday = DAYS[dayIndex] as DayName;
        eventsByDay[weekday] = timeBlocks;

        if (opts.outputMode === '2') {
            const cycleDay = weekdayCdMap[weekday];
            const dayLabel = `${weekday} (CD ${cycleDay})`;
            const table = generateCombinedTable({ [weekday]: timeBlocks }, [weekday] as DayName[], [dayLabel]);
            const heading = buildDayHeading(cursor, weekday, cycleDay);
            const filePrefix = WEEKDAY_FILE_PREFIX[jsDay];
            await writeVaultFile(
                app,
                `${settings.outputDir}/${opts.phase}/${filePrefix}.md`,
                heading + table,
            );
        }

        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }

    if (opts.outputMode === '1') {
        const dayLabels = DAYS.map(d => `${d} (CD ${weekdayCdMap[d]})`);
        const table = generateCombinedTable(eventsByDay, DAYS, dayLabels);

        const startDateObj = new Date(opts.startDate + 'T12:00:00Z');
        const [mondayStr, sundayStr] = computeWeekRange(startDateObj);

        const heading =
            `\n## CD ${opts.mondayCycleDay} – ${endCd}\n\n` +
            `#### ${mondayStr} — ${sundayStr}\n\n`;

        await writeVaultFile(
            app,
            `${settings.outputDir}/${opts.phase}/combined_schedule.md`,
            heading + table,
        );
    }

    return { noEventDays };
}

async function writeVaultFile(app: App, relativePath: string, content: string): Promise<void> {
    const adapter = app.vault.adapter;

    // Ensure parent directories exist
    const parts = relativePath.split('/');
    for (let i = 1; i < parts.length; i++) {
        const dir = parts.slice(0, i).join('/');
        if (!(await adapter.exists(dir))) {
            await adapter.mkdir(dir);
        }
    }

    await adapter.write(relativePath, content);
    new Notice(`Wrote: ${relativePath}`);
}
