import { describe, it, expect } from 'vitest';
import { defaultColumnWidth, type BulkFieldType } from '../BulkEntityConfig';

/**
 * Guards the fix for horizontal clipping of inline editors in the bulk-edit
 * table (narrow columns truncated the date input and clipped the ~238px
 * calendar popover). Date and reference/enum columns must start wide enough
 * that their editor and overlay are usable without resizing.
 */
describe('defaultColumnWidth', () => {
    it('gives date columns room for the input + calendar popover (>= 200px)', () => {
        // The CloudScape calendar grid is a fixed ~238px; the column should be
        // wide enough that the input is not truncated before the user opens it.
        expect(defaultColumnWidth('date')).toBeGreaterThanOrEqual(200);
    });

    it('gives reference columns the most room (Autosuggest + clear button)', () => {
        expect(defaultColumnWidth('reference')).toBeGreaterThanOrEqual(240);
    });

    it('gives enum (Select) columns breathing room for option labels', () => {
        expect(defaultColumnWidth('enum')).toBeGreaterThanOrEqual(180);
    });

    it('keeps number columns compact', () => {
        expect(defaultColumnWidth('number')).toBeLessThanOrEqual(160);
    });

    it('returns a positive width for every field type', () => {
        const types: BulkFieldType[] = ['text', 'number', 'date', 'enum', 'reference'];
        for (const t of types) {
            expect(defaultColumnWidth(t)).toBeGreaterThan(0);
        }
    });
});
