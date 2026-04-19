import { TIME_BLOCKS, expandEventToBlockKeys, midnightInLA } from '../timeblocks';

describe('TIME_BLOCKS', () => {
    test('has 32 entries (7:00 AM to 10:30 PM in 30-min steps)', () => {
        expect(TIME_BLOCKS).toHaveLength(32);
    });

    test('starts at 7:00 AM', () => {
        expect(TIME_BLOCKS[0]).toBe('7:00 AM');
    });

    test('ends at 10:30 PM', () => {
        expect(TIME_BLOCKS[TIME_BLOCKS.length - 1]).toBe('10:30 PM');
    });

    test('noon transition: 11:30 AM is followed by 12:00 PM', () => {
        const elevenThirty = TIME_BLOCKS.indexOf('11:30 AM');
        expect(elevenThirty).toBeGreaterThan(-1);
        expect(TIME_BLOCKS[elevenThirty + 1]).toBe('12:00 PM');
    });

    test('all entries match the expected format', () => {
        const re = /^\d{1,2}:\d{2} (AM|PM)$/;
        TIME_BLOCKS.forEach(block => expect(block).toMatch(re));
    });
});

describe('expandEventToBlockKeys', () => {
    // All times in PST (UTC-8) — 2026-02-23 is in standard time

    test('30-min event maps to exactly one block', () => {
        // 3:00 PM PST = 23:00 UTC; 3:30 PM = 23:30 UTC
        expect(expandEventToBlockKeys(
            '2026-02-23T23:00:00Z',
            '2026-02-23T23:30:00Z',
        )).toEqual(['3:00 PM']);
    });

    test('1-hour event maps to two consecutive blocks', () => {
        // 3:00–4:00 PM PST
        expect(expandEventToBlockKeys(
            '2026-02-23T23:00:00Z',
            '2026-02-24T00:00:00Z',
        )).toEqual(['3:00 PM', '3:30 PM']);
    });

    test('event starting at :15 is floored to the :00 block', () => {
        // 3:15–3:45 PM PST → spans :00 and :30 blocks
        expect(expandEventToBlockKeys(
            '2026-02-23T23:15:00Z',
            '2026-02-23T23:45:00Z',
        )).toEqual(['3:00 PM', '3:30 PM']);
    });

    test('event starting at :30 uses only the :30 block', () => {
        // 3:30–4:00 PM PST
        expect(expandEventToBlockKeys(
            '2026-02-23T23:30:00Z',
            '2026-02-24T00:00:00Z',
        )).toEqual(['3:30 PM']);
    });

    test('midnight-crossing event produces correct blocks', () => {
        // 7:00 AM PST = 15:00 UTC; 7:30 AM = 15:30 UTC
        expect(expandEventToBlockKeys(
            '2026-02-23T15:00:00Z',
            '2026-02-23T15:30:00Z',
        )).toEqual(['7:00 AM']);
    });
});

describe('midnightInLA', () => {
    test('returns a UTC date whose LA local time is 00:00 (PST, UTC-8)', () => {
        // Feb 23 is in PST → midnight LA = 08:00 UTC
        const midnight = midnightInLA('2026-02-23');
        expect(midnight.getUTCHours()).toBe(8);
        expect(midnight.getUTCMinutes()).toBe(0);
        expect(midnight.getUTCFullYear()).toBe(2026);
        expect(midnight.getUTCMonth()).toBe(1); // 0-indexed
        expect(midnight.getUTCDate()).toBe(23);
    });

    test('returns a UTC date whose LA local time is 00:00 (PDT, UTC-7)', () => {
        // Jul 4 is in PDT → midnight LA = 07:00 UTC
        const midnight = midnightInLA('2026-07-04');
        expect(midnight.getUTCHours()).toBe(7);
        expect(midnight.getUTCDate()).toBe(4);
        expect(midnight.getUTCMonth()).toBe(6); // July
    });
});
