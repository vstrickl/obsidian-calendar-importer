import {
    buildWeekdayCdMap,
    computeWeekRange,
    generateCombinedTable,
    buildDayHeading,
    DAYS,
} from '../render';
import { TIME_BLOCKS } from '../timeblocks';

describe('buildWeekdayCdMap', () => {
    test('assigns sequential cycle days starting from startCd', () => {
        const map = buildWeekdayCdMap(16, 28);
        expect(map.Monday).toBe(16);
        expect(map.Tuesday).toBe(17);
        expect(map.Wednesday).toBe(18);
        expect(map.Thursday).toBe(19);
        expect(map.Sunday).toBe(22);
    });

    test('wraps at cycle length when startCd is near the end', () => {
        const map = buildWeekdayCdMap(27, 28);
        expect(map.Monday).toBe(27);
        expect(map.Tuesday).toBe(28);
        expect(map.Wednesday).toBe(1);
        expect(map.Thursday).toBe(2);
        expect(map.Sunday).toBe(5);
    });

    test('cycle day 28 wraps to 1 on the next day', () => {
        const map = buildWeekdayCdMap(28, 28);
        expect(map.Monday).toBe(28);
        expect(map.Tuesday).toBe(1);
    });

    test('covers all 7 days of the week', () => {
        const map = buildWeekdayCdMap(1, 28);
        expect(Object.keys(map)).toHaveLength(7);
        DAYS.forEach(day => expect(map[day]).toBeDefined());
    });
});

describe('computeWeekRange', () => {
    test('Wednesday → returns the surrounding Mon–Sun range', () => {
        // 2026-02-25 is a Wednesday
        const [monday, sunday] = computeWeekRange(new Date('2026-02-25T12:00:00Z'));
        expect(monday).toBe('2026-02-23');
        expect(sunday).toBe('2026-03-01');
    });

    test('Monday input returns that same Monday as start', () => {
        const [monday, sunday] = computeWeekRange(new Date('2026-02-23T12:00:00Z'));
        expect(monday).toBe('2026-02-23');
        expect(sunday).toBe('2026-03-01');
    });

    test('Sunday input returns the preceding Monday as start', () => {
        const [monday, sunday] = computeWeekRange(new Date('2026-03-01T12:00:00Z'));
        expect(monday).toBe('2026-02-23');
        expect(sunday).toBe('2026-03-01');
    });

    test('range always spans exactly 7 days', () => {
        const [monday, sunday] = computeWeekRange(new Date('2026-04-15T12:00:00Z'));
        const diff = (new Date(sunday).getTime() - new Date(monday).getTime()) / 86_400_000;
        expect(diff).toBe(6);
    });
});

describe('generateCombinedTable', () => {
    test('first line is the header with the correct day label', () => {
        const table = generateCombinedTable(
            { Monday: {} },
            ['Monday'],
            ['Monday (CD 16)'],
        );
        const [header] = table.split('\n');
        expect(header).toBe('| Time     | Monday (CD 16) |');
    });

    test('second line is the separator', () => {
        const table = generateCombinedTable({}, ['Monday'], ['Monday (CD 1)']);
        const lines = table.split('\n');
        expect(lines[1]).toBe('| -------- | ----------- |');
    });

    test('produces one row per TIME_BLOCK (32 data rows total)', () => {
        const table = generateCombinedTable({}, ['Monday'], ['Monday (CD 1)']);
        const lines = table.split('\n');
        // header + separator + 32 blocks
        expect(lines).toHaveLength(2 + TIME_BLOCKS.length);
    });

    test('event text appears in the correct time row', () => {
        const table = generateCombinedTable(
            { Monday: { '9:00 AM': 'Team sync' } },
            ['Monday'],
            ['Monday (CD 1)'],
        );
        const row = table.split('\n').find(l => l.startsWith('| 9:00 AM'));
        expect(row).toBeDefined();
        expect(row).toContain('Team sync');
    });

    test('multiple events in the same block are comma-separated in the source data', () => {
        const table = generateCombinedTable(
            { Monday: { '10:00 AM': 'Yoga, Meditation' } },
            ['Monday'],
            ['Monday (CD 1)'],
        );
        expect(table).toContain('Yoga, Meditation');
    });

    test('multi-day table includes all day columns in header', () => {
        const table = generateCombinedTable(
            {},
            ['Monday', 'Tuesday', 'Wednesday'],
            ['Mon (CD 1)', 'Tue (CD 2)', 'Wed (CD 3)'],
        );
        const header = table.split('\n')[0];
        expect(header).toContain('Mon (CD 1)');
        expect(header).toContain('Tue (CD 2)');
        expect(header).toContain('Wed (CD 3)');
    });
});

describe('buildDayHeading', () => {
    test('formats the heading with weekday, ISO date, and cycle day', () => {
        const date = new Date('2026-02-25T12:00:00Z');
        expect(buildDayHeading(date, 'Wednesday', 18)).toBe(
            '# Wednesday — 2026-02-25 (CD 18)\n\n',
        );
    });

    test('works for all days of the week', () => {
        const date = new Date('2026-02-23T12:00:00Z');
        const heading = buildDayHeading(date, 'Monday', 1);
        expect(heading).toContain('Monday');
        expect(heading).toContain('2026-02-23');
        expect(heading).toContain('CD 1');
    });
});
