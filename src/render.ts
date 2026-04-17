import { TIME_BLOCKS } from './timeblocks';

export const DAYS = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

export type DayName = typeof DAYS[number];

// Maps weekday index (Date.getDay(), 0=Sun) to file prefix, mirroring writer.py WEEKDAY_MAP
export const WEEKDAY_FILE_PREFIX: Record<number, string> = {
    1: '1_Monday',
    2: '2_Tuesday',
    3: '3_Wednesday',
    4: '4_Thursday',
    5: '5_Friday',
    6: '6_Saturday',
    0: '7_Sunday',
};

// Port of build_weekday_cd_map from render.py
export function buildWeekdayCdMap(startCd: number, cycleLen: number): Record<DayName, number> {
    const map = {} as Record<DayName, number>;
    DAYS.forEach((day, idx) => {
        map[day] = ((startCd - 1 + idx) % cycleLen) + 1;
    });
    return map;
}

// Port of compute_week_range from render.py — returns [mondayStr, sundayStr]
export function computeWeekRange(startDate: Date): [string, string] {
    const d = new Date(startDate);
    const day = d.getUTCDay(); // 0=Sun, 1=Mon …
    const daysFromMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysFromMonday));
    const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
    return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
}

// Port of generate_combined_table from render.py
export function generateCombinedTable(
    eventsByDay: Partial<Record<DayName, Record<string, string>>>,
    dayOrder: readonly DayName[],
    dayLabels: string[],
): string {
    const header    = `| Time     | ${dayLabels.join(' | ')} |`;
    const separator = `| -------- |${' ----------- |'.repeat(dayLabels.length)}`;

    const rows = TIME_BLOCKS.map(block => {
        const cells = dayOrder.map(day => {
            const v = eventsByDay[day]?.[block] ?? '';
            return v.padEnd(40);
        });
        return `| ${block.padEnd(8)} | ${cells.join(' | ')} |`;
    });

    return [header, separator, ...rows].join('\n');
}

// Per-day heading, mirroring writer.py write_markdown_file heading
export function buildDayHeading(date: Date, dayName: DayName, cycleDay: number): string {
    const iso = date.toISOString().slice(0, 10);
    return `# ${dayName} — ${iso} (CD ${cycleDay})\n\n`;
}
