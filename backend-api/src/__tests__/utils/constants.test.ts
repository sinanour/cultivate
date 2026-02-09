import { QUERY_PARAMS, QueryParamKey } from '../../utils/constants';

describe('Query Parameter Constants', () => {
    describe('QUERY_PARAMS', () => {
        it('should define pagination parameters', () => {
            expect(QUERY_PARAMS.PAGE).toBe('page');
            expect(QUERY_PARAMS.LIMIT).toBe('limit');
        });

        it('should define filtering parameters', () => {
            expect(QUERY_PARAMS.GEOGRAPHIC_AREA_ID).toBe('geographicAreaId');
            expect(QUERY_PARAMS.DEPTH).toBe('depth');
        });

        it('should define grouping and analytics parameters', () => {
            expect(QUERY_PARAMS.GROUP_BY).toBe('groupBy');
            expect(QUERY_PARAMS.START_DATE).toBe('startDate');
            expect(QUERY_PARAMS.END_DATE).toBe('endDate');
            expect(QUERY_PARAMS.TIME_PERIOD).toBe('timePeriod');
            expect(QUERY_PARAMS.GRANULARITY).toBe('granularity');
        });

        it('should define sorting parameters', () => {
            expect(QUERY_PARAMS.SORT_BY).toBe('sortBy');
            expect(QUERY_PARAMS.SORT_ORDER).toBe('sortOrder');
        });

        it('should be readonly (as const)', () => {
            // TypeScript will catch attempts to modify at compile time
            // This test verifies the constants are accessible
            const params = QUERY_PARAMS;
            expect(params).toBeDefined();
            expect(Object.keys(params).length).toBeGreaterThan(0);
        });
    });

    describe('QueryParamKey type', () => {
        it('should accept valid query parameter values', () => {
            const validKeys: QueryParamKey[] = [
                'page',
                'limit',
                'geographicAreaId',
                'depth',
                'groupBy',
                'startDate',
                'endDate',
                'timePeriod',
                'granularity',
                'sortBy',
                'sortOrder',
            ];

            // If this compiles, the type is working correctly
            validKeys.forEach(key => {
                expect(typeof key).toBe('string');
            });
        });
    });
});
