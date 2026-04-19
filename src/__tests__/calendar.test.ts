import { resolveCalendars, CalendarInfo } from '../calendar';

const MOCK_CALENDARS: CalendarInfo[] = [
    { id: 'primary',                                             summary: 'My Calendar' },
    { id: '31aqt40ea4dh6or4to0rkpa914@group.calendar.google.com', summary: 'Work' },
    { id: 'nutrition-cal-id',                                   summary: 'Nutrition' },
    { id: 'hair-beauty-id',                                     summary: 'Hair & Beauty' },
    { id: 'training-id',                                        summary: 'My Training' },
];

describe('resolveCalendars', () => {
    test('matches by summary name', () => {
        const result = resolveCalendars(MOCK_CALENDARS, ['Nutrition']);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('nutrition-cal-id');
    });

    test('matches by calendar ID', () => {
        const result = resolveCalendars(MOCK_CALENDARS, ['primary']);
        expect(result).toHaveLength(1);
        expect(result[0].summary).toBe('My Calendar');
    });

    test('matches a long group calendar ID', () => {
        const result = resolveCalendars(
            MOCK_CALENDARS,
            ['31aqt40ea4dh6or4to0rkpa914@group.calendar.google.com'],
        );
        expect(result).toHaveLength(1);
        expect(result[0].summary).toBe('Work');
    });

    test('returns empty array for unmatched tokens', () => {
        const result = resolveCalendars(MOCK_CALENDARS, ['NonExistent']);
        expect(result).toHaveLength(0);
    });

    test('skips blank and whitespace-only tokens', () => {
        const result = resolveCalendars(MOCK_CALENDARS, ['', '   ', 'Nutrition']);
        expect(result).toHaveLength(1);
        expect(result[0].summary).toBe('Nutrition');
    });

    test('resolves multiple calendars in one call', () => {
        const result = resolveCalendars(MOCK_CALENDARS, ['My Calendar', 'Nutrition', 'My Training']);
        expect(result).toHaveLength(3);
        const summaries = result.map(c => c.summary);
        expect(summaries).toContain('My Calendar');
        expect(summaries).toContain('Nutrition');
        expect(summaries).toContain('My Training');
    });

    test('ID match takes priority over name match when both exist', () => {
        const ambiguous: CalendarInfo[] = [
            { id: 'real-id',   summary: 'Work' },
            { id: 'Work',      summary: 'Something Else' },
        ];
        // 'Work' as a token should match by id first
        const result = resolveCalendars(ambiguous, ['Work']);
        expect(result[0].summary).toBe('Something Else'); // id='Work' matched
    });

    test('returns empty array when no calendars are available', () => {
        const result = resolveCalendars([], ['Nutrition', 'Work']);
        expect(result).toHaveLength(0);
    });

    test('returns empty array for an empty token list', () => {
        const result = resolveCalendars(MOCK_CALENDARS, []);
        expect(result).toHaveLength(0);
    });

    test('handles the same calendar name appearing in the token list twice', () => {
        // Each match is added independently — duplicates in tokens produce duplicates in result
        const result = resolveCalendars(MOCK_CALENDARS, ['Nutrition', 'Nutrition']);
        expect(result).toHaveLength(2);
    });

    test('summary match with special characters', () => {
        const result = resolveCalendars(MOCK_CALENDARS, ['Hair & Beauty']);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('hair-beauty-id');
    });
});
