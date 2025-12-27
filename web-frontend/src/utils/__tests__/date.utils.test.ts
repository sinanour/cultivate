import { describe, it, expect } from 'vitest';
import { formatDate } from '../date.utils';

describe('formatDate', () => {
    it('should format full ISO-8601 datetime strings to YYYY-MM-DD', () => {
        expect(formatDate('2024-03-15T10:30:00Z')).toBe('2024-03-15');
        expect(formatDate('2024-12-31T23:59:59.999Z')).toBe('2024-12-31');
        expect(formatDate('2024-01-01T00:00:00.000Z')).toBe('2024-01-01');
    });

    it('should handle date-only strings', () => {
        expect(formatDate('2024-03-15')).toBe('2024-03-15');
        expect(formatDate('2024-12-31')).toBe('2024-12-31');
        expect(formatDate('2024-01-01')).toBe('2024-01-01');
    });

    it('should return empty string for null', () => {
        expect(formatDate(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
        expect(formatDate(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
        expect(formatDate('')).toBe('');
    });

    it('should handle dates with timezone offsets', () => {
        expect(formatDate('2024-03-15T10:30:00-05:00')).toBe('2024-03-15');
        expect(formatDate('2024-03-15T10:30:00+08:00')).toBe('2024-03-15');
    });

    it('should handle dates with milliseconds', () => {
        expect(formatDate('2024-03-15T10:30:00.123Z')).toBe('2024-03-15');
        expect(formatDate('2024-03-15T10:30:00.999999Z')).toBe('2024-03-15');
    });
});
