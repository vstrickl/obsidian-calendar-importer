import { requestUrl } from 'obsidian';

export interface CalendarInfo {
    id: string;
    summary: string;
}

export interface CalendarEvent {
    summary?: string;
    status?: string;
    start: { dateTime?: string; date?: string };
    end:   { dateTime?: string; date?: string };
}

const BASE_URL = 'https://www.googleapis.com/calendar/v3';

export async function listCalendars(accessToken: string): Promise<CalendarInfo[]> {
    const resp = await requestUrl({
        url: `${BASE_URL}/users/me/calendarList`,
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const items: Array<{ id: string; summary?: string }> = resp.json.items ?? [];
    return items.map(item => ({ id: item.id, summary: item.summary ?? item.id }));
}

export async function fetchDayEvents(
    accessToken: string,
    calendarId: string,
    dayStartUtc: Date,
): Promise<CalendarEvent[]> {
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
        timeMin: dayStartUtc.toISOString(),
        timeMax: dayEndUtc.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
    });

    try {
        const resp = await requestUrl({
            url: `${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const items: CalendarEvent[] = resp.json.items ?? [];
        return items.filter(e => e.status !== 'cancelled');
    } catch {
        return [];
    }
}

export function resolveCalendars(
    allCalendars: CalendarInfo[],
    tokens: string[],
): CalendarInfo[] {
    const resolved: CalendarInfo[] = [];
    for (const tok of tokens) {
        const t = tok.trim();
        if (!t) continue;
        const match =
            allCalendars.find(c => c.id === t) ??
            allCalendars.find(c => c.summary === t);
        if (match) resolved.push(match);
    }
    return resolved;
}
