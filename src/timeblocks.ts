const LOCAL_TZ = 'America/Los_Angeles';

// "7:00 AM" … "10:30 PM" — 32 half-hour blocks, mirroring timeblocks.py
export const TIME_BLOCKS: string[] = (() => {
    const blocks: string[] = [];
    for (let h = 7; h < 23; h++) {
        const suffix = h < 12 ? 'AM' : 'PM';
        const h12 = h % 12 || 12;
        for (const m of [0, 30]) {
            blocks.push(`${h12}:${m.toString().padStart(2, '0')} ${suffix}`);
        }
    }
    return blocks;
})();

function getLocalParts(date: Date): { hour: number; minute: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: LOCAL_TZ,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const hour   = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
    // Intl may return 24 for midnight
    return { hour: hour === 24 ? 0 : hour, minute };
}

function dateToBlockKey(date: Date): string {
    const { hour, minute } = getLocalParts(date);
    const suffix = hour < 12 ? 'AM' : 'PM';
    const h12 = hour % 12 || 12;
    return `${h12}:${minute.toString().padStart(2, '0')} ${suffix}`;
}

// Port of expand_event_to_block_keys from timeblocks.py
export function expandEventToBlockKeys(startIso: string, endIso: string): string[] {
    const startDate = new Date(startIso);
    const endDate   = new Date(endIso);

    // Floor start to nearest 30-minute boundary in local time
    const { minute } = getLocalParts(startDate);
    const flooredMinute = minute < 30 ? 0 : 30;
    const diffMs =
        (minute - flooredMinute) * 60_000 +
        startDate.getSeconds() * 1000 +
        startDate.getMilliseconds();
    let cursor = new Date(startDate.getTime() - diffMs);

    const keys: string[] = [];
    while (cursor < endDate) {
        keys.push(dateToBlockKey(cursor));
        cursor = new Date(cursor.getTime() + 30 * 60_000);
    }
    return keys;
}

// Returns the UTC Date representing midnight in America/Los_Angeles on dateStr ("YYYY-MM-DD").
export function midnightInLA(dateStr: string): Date {
    const parts = dateStr.split('-').map(Number);
    const year = parts[0] as number;
    const month = parts[1] as number;
    const day = parts[2] as number;
    // LA is UTC-7 (PDT) or UTC-8 (PST); searching hours 5–11 UTC covers both
    for (let utcHour = 5; utcHour <= 11; utcHour++) {
        const candidate = new Date(Date.UTC(year, month - 1, day, utcHour));
        const { hour, minute } = getLocalParts(candidate);
        if (hour === 0 && minute === 0) return candidate;
    }
    // Should never be reached for a valid Gregorian date
    throw new Error(`Could not determine midnight in America/Los_Angeles for ${dateStr}`);
}
