import {
    parseIntegerParam,
    parsePaginationParams,
    normalizeArrayParam,
    QUERY_PARAMS,
} from '../../utils/query-params.utils';
import { PAGINATION } from '../../utils/constants';

describe('Query Parameter Utilities', () => {
    describe('parseIntegerParam', () => {
        it('should parse valid positive integers', () => {
            expect(parseIntegerParam('42', 'test')).toEqual({ value: 42 });
            expect(parseIntegerParam('1', 'test')).toEqual({ value: 1 });
            expect(parseIntegerParam('100', 'test')).toEqual({ value: 100 });
        });

        it('should handle undefined and null values', () => {
            expect(parseIntegerParam(undefined, 'test')).toEqual({ value: undefined });
            expect(parseIntegerParam(null, 'test')).toEqual({ value: undefined });
        });

        it('should return error for non-numeric values', () => {
            expect(parseIntegerParam('abc', 'page')).toEqual({
                error: 'page must be a valid integer',
            });
            expect(parseIntegerParam('12.5', 'limit')).toEqual({ value: 12 }); // parseInt truncates
            expect(parseIntegerParam('', 'test')).toEqual({
                error: 'test must be a valid integer',
            });
        });

        it('should parse negative integers', () => {
            expect(parseIntegerParam('-5', 'test')).toEqual({ value: -5 });
            expect(parseIntegerParam('-100', 'test')).toEqual({ value: -100 });
        });

        it('should parse zero', () => {
            expect(parseIntegerParam('0', 'test')).toEqual({ value: 0 });
        });
    });

    describe('parsePaginationParams', () => {
        describe('valid inputs', () => {
            it('should parse valid page and limit', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.PAGE]: '1',
                    [QUERY_PARAMS.LIMIT]: '50',
                });
                expect(result.pagination).toEqual({ page: 1, limit: 50 });
                expect(result.errors).toEqual([]);
            });

            it('should parse page only', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.PAGE]: '2',
                });
                expect(result.pagination).toEqual({ page: 2 });
                expect(result.errors).toEqual([]);
            });

            it('should parse limit only', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.LIMIT]: '25',
                });
                expect(result.pagination).toEqual({ limit: 25 });
                expect(result.errors).toEqual([]);
            });

            it('should handle empty query object', () => {
                const result = parsePaginationParams({});
                expect(result.pagination).toEqual({});
                expect(result.errors).toEqual([]);
            });

            it('should parse maximum valid limit', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.LIMIT]: PAGINATION.MAX_LIMIT.toString(),
                });
                expect(result.pagination).toEqual({ limit: PAGINATION.MAX_LIMIT });
                expect(result.errors).toEqual([]);
            });
        });

        describe('invalid inputs', () => {
            it('should return error for non-numeric page', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.PAGE]: 'abc',
                });
                expect(result.pagination).toEqual({});
                expect(result.errors).toContain('page must be a valid integer');
            });

            it('should return error for non-numeric limit', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.LIMIT]: 'xyz',
                });
                expect(result.pagination).toEqual({});
                expect(result.errors).toContain('limit must be a valid integer');
            });

            it('should return error for page < 1', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.PAGE]: '0',
                });
                expect(result.pagination).toEqual({});
                expect(result.errors).toContain('Page must be >= 1');
            });

            it('should return error for negative page', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.PAGE]: '-5',
                });
                expect(result.pagination).toEqual({});
                expect(result.errors).toContain('Page must be >= 1');
            });

            it('should return error for limit < 1', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.LIMIT]: '0',
                });
                expect(result.pagination).toEqual({});
                expect(result.errors).toContain('Limit must be >= 1');
            });

            it('should return error for limit > MAX_LIMIT', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.LIMIT]: (PAGINATION.MAX_LIMIT + 1).toString(),
                });
                expect(result.pagination).toEqual({});
                expect(result.errors).toContain(`Limit must be <= ${PAGINATION.MAX_LIMIT}`);
            });

            it('should accumulate multiple errors', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.PAGE]: 'abc',
                    [QUERY_PARAMS.LIMIT]: 'xyz',
                });
                expect(result.pagination).toEqual({});
                expect(result.errors).toHaveLength(2);
                expect(result.errors).toContain('page must be a valid integer');
                expect(result.errors).toContain('limit must be a valid integer');
            });
        });

        describe('edge cases', () => {
            it('should handle page=0 as invalid', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.PAGE]: '0',
                });
                expect(result.pagination).toEqual({});
                expect(result.errors).toContain('Page must be >= 1');
            });

            it('should handle limit at MAX_LIMIT boundary', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.LIMIT]: PAGINATION.MAX_LIMIT.toString(),
                });
                expect(result.pagination.limit).toBe(PAGINATION.MAX_LIMIT);
                expect(result.errors).toEqual([]);
            });

            it('should handle limit just over MAX_LIMIT', () => {
                const result = parsePaginationParams({
                    [QUERY_PARAMS.LIMIT]: (PAGINATION.MAX_LIMIT + 1).toString(),
                });
                expect(result.pagination).toEqual({});
                expect(result.errors).toContain(`Limit must be <= ${PAGINATION.MAX_LIMIT}`);
            });
        });
    });

    describe('normalizeArrayParam', () => {
        it('should return undefined for undefined input', () => {
            expect(normalizeArrayParam(undefined)).toBeUndefined();
        });

        it('should return undefined for null input', () => {
            expect(normalizeArrayParam(null as any)).toBeUndefined();
        });

        it('should wrap single string in array', () => {
            expect(normalizeArrayParam('abc123')).toEqual(['abc123']);
        });

        it('should return array unchanged', () => {
            expect(normalizeArrayParam(['abc123', 'def456'])).toEqual(['abc123', 'def456']);
        });

        it('should split comma-separated string', () => {
            expect(normalizeArrayParam('abc123,def456')).toEqual(['abc123', 'def456']);
        });

        it('should handle comma-separated values in array', () => {
            expect(normalizeArrayParam(['abc123', 'def456,ghi789'])).toEqual([
                'abc123',
                'def456',
                'ghi789',
            ]);
        });

        it('should trim whitespace', () => {
            expect(normalizeArrayParam('abc123, def456 , ghi789')).toEqual([
                'abc123',
                'def456',
                'ghi789',
            ]);
        });

        it('should filter empty strings', () => {
            expect(normalizeArrayParam('abc123,,def456')).toEqual(['abc123', 'def456']);
            expect(normalizeArrayParam(['abc123', '', 'def456'])).toEqual(['abc123', 'def456']);
        });

        it('should return undefined for empty string', () => {
            expect(normalizeArrayParam('')).toBeUndefined();
        });

        it('should return undefined for array of empty strings', () => {
            expect(normalizeArrayParam(['', ''])).toBeUndefined();
        });
    });
});
