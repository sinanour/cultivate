import { PrismaClient } from '@prisma/client';
import { GeographicBreakdownQueryBuilder, GeographicBreakdownFilters } from '../../services/analytics/geographic-breakdown-query-builder';

describe('GeographicBreakdownQueryBuilder', () => {
    let prisma: PrismaClient;
    let queryBuilder: GeographicBreakdownQueryBuilder;

    beforeEach(() => {
        prisma = new PrismaClient();
        queryBuilder = new GeographicBreakdownQueryBuilder(prisma);
    });

    afterEach(async () => {
        await prisma.$disconnect();
    });

    describe('buildAreaDescendantsCTE', () => {
        it('should generate VALUES clause with area-to-descendants mapping', () => {
            const areaIds = ['area-1', 'area-2'];
            const areaToDescendantsMap = new Map([
                ['area-1', ['area-1', 'child-1', 'child-2']],
                ['area-2', ['area-2', 'child-3']],
            ]);

            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                areaIds,
                areaToDescendantsMap,
                {}
            );

            expect(sql).toContain('area_descendants(area_id, descendant_ids)');
            expect(sql).toContain("('area-1', ARRAY['area-1', 'child-1', 'child-2']");
            expect(sql).toContain("('area-2', ARRAY['area-2', 'child-3']");
        });

        it('should handle empty area list', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                [],
                new Map(),
                {}
            );

            expect(sql).toContain('area_descendants(area_id, descendant_ids)');
            expect(sql).toContain('WHERE false');
        });

        it('should handle area with no descendants', () => {
            const areaIds = ['area-1'];
            const areaToDescendantsMap = new Map([
                ['area-1', ['area-1']],
            ]);

            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                areaIds,
                areaToDescendantsMap,
                {}
            );

            expect(sql).toContain("('area-1', ARRAY['area-1']");
        });
    });

    describe('buildFilteredActivitiesCTE', () => {
        it('should include base joins without filters', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {}
            );

            expect(sql).toContain('filtered_activities AS');
            expect(sql).toContain('FROM activities a');
            expect(sql).toContain('JOIN activity_venue_history avh');
            expect(sql).toContain('JOIN venues v');
        });

        it('should apply activity type filter', () => {
            const filters: GeographicBreakdownFilters = {
                activityTypeIds: ['type-1', 'type-2'],
            };

            const { sql, parameters } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                filters
            );

            expect(sql).toContain('a."activityTypeId" = ANY($1)');
            expect(parameters).toEqual([['type-1', 'type-2']]);
        });

        it('should apply activity category filter', () => {
            const filters: GeographicBreakdownFilters = {
                activityCategoryIds: ['cat-1', 'cat-2'],
            };

            const { sql, parameters } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                filters
            );

            expect(sql).toContain('JOIN activity_types at');
            expect(sql).toContain('at."activityCategoryId" = ANY($1)');
            expect(parameters).toEqual([['cat-1', 'cat-2']]);
        });

        it('should apply venue filter', () => {
            const filters: GeographicBreakdownFilters = {
                venueIds: ['venue-1', 'venue-2'],
            };

            const { sql, parameters } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                filters
            );

            expect(sql).toContain('avh."venueId" = ANY($1)');
            expect(parameters).toEqual([['venue-1', 'venue-2']]);
        });

        it('should apply date range filter', () => {
            const filters: GeographicBreakdownFilters = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-12-31'),
            };

            const { sql, parameters } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                filters
            );

            expect(sql).toContain('DATE(a."startDate") <= DATE($1)');
            expect(sql).toContain('a."endDate" IS NULL OR DATE(a."endDate") >= DATE($2)');
            expect(parameters).toHaveLength(2);
        });

        it('should apply population filter', () => {
            const filters: GeographicBreakdownFilters = {
                populationIds: ['pop-1', 'pop-2'],
            };

            const { sql, parameters } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                filters
            );

            expect(sql).toContain('EXISTS');
            expect(sql).toContain('participant_populations pp');
            expect(sql).toContain('pp."populationId" = ANY($1)');
            expect(parameters).toEqual([['pop-1', 'pop-2']]);
        });

        it('should apply multiple filters with AND logic', () => {
            const filters: GeographicBreakdownFilters = {
                activityTypeIds: ['type-1'],
                venueIds: ['venue-1'],
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-12-31'),
            };

            const { sql, parameters } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                filters
            );

            expect(sql).toContain('a."activityTypeId" = ANY($1)');
            expect(sql).toContain('avh."venueId" = ANY($2)');
            expect(sql).toContain('DATE(a."startDate") <= DATE($3)');
            expect(parameters).toHaveLength(4);
        });
    });

    describe('buildAreaMetricsCTE', () => {
        it('should include GROUP BY and aggregation functions', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {}
            );

            expect(sql).toContain('area_metrics AS');
            expect(sql).toContain('COUNT(DISTINCT fa.id) as "activityCount"');
            expect(sql).toContain('COUNT(DISTINCT asn."participantId") as "participantCount"');
            expect(sql).toContain('COUNT(asn.id) as "participationCount"');
            expect(sql).toContain('GROUP BY ad.area_id');
        });

        it('should include HAVING clause to filter zero-metric areas', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {}
            );

            expect(sql).toContain('HAVING');
            expect(sql).toContain('COUNT(DISTINCT fa.id) > 0');
            expect(sql).toContain('COUNT(DISTINCT asn."participantId") > 0');
            expect(sql).toContain('COUNT(asn.id) > 0');
        });

        it('should filter out areas with zero metrics using HAVING clause', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {}
            );

            expect(sql).toContain('HAVING');
            expect(sql).toContain('COUNT(DISTINCT fa.id) > 0');
            expect(sql).toContain('COUNT(DISTINCT asn."participantId") > 0');
            expect(sql).toContain('COUNT(asn.id) > 0');
            // Should NOT preserve areas with children if they have zero metrics
            expect(sql).not.toContain('ga."parentGeographicAreaId" = ad.area_id');
        });

        it('should use LEFT JOIN to include areas with zero activities', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {}
            );

            expect(sql).toContain('LEFT JOIN filtered_activities fa');
            expect(sql).toContain('LEFT JOIN assignments asn');
        });

        it('should join on descendant_ids array', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1', 'child-1']]]),
                {}
            );

            expect(sql).toContain('fa."geographicAreaId" = ANY(ad.descendant_ids)');
        });
    });

    describe('buildPaginationClause', () => {
        it('should not add pagination when no params provided', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {},
                undefined
            );

            expect(sql).not.toContain('LIMIT');
            expect(sql).not.toContain('OFFSET');
        });

        it('should add LIMIT and OFFSET with pagination params', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {},
                { page: 2, pageSize: 50 }
            );

            expect(sql).toContain('LIMIT 50 OFFSET 50');
        });

        it('should calculate offset correctly for page 1', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {},
                { page: 1, pageSize: 100 }
            );

            expect(sql).toContain('LIMIT 100 OFFSET 0');
        });

        it('should calculate offset correctly for page 3', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {},
                { page: 3, pageSize: 25 }
            );

            expect(sql).toContain('LIMIT 25 OFFSET 50');
        });

        it('should use default page size of 100', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {},
                { page: 1 }
            );

            expect(sql).toContain('LIMIT 100 OFFSET 0');
        });
    });

    describe('buildCountQuery', () => {
        it('should wrap main query in COUNT subquery', () => {
            const { sql } = queryBuilder.buildCountQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {}
            );

            expect(sql).toContain('SELECT COUNT(*) as total FROM');
            expect(sql).toContain('AS count_query');
        });

        it('should not include LIMIT/OFFSET in COUNT query', () => {
            const { sql } = queryBuilder.buildCountQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {}
            );

            expect(sql).not.toContain('LIMIT');
            expect(sql).not.toContain('OFFSET');
        });

        it('should include same filters as main query', () => {
            const filters: GeographicBreakdownFilters = {
                activityTypeIds: ['type-1'],
                venueIds: ['venue-1'],
            };

            const { sql, parameters } = queryBuilder.buildCountQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                filters
            );

            expect(sql).toContain('a."activityTypeId" = ANY($1)');
            expect(sql).toContain('avh."venueId" = ANY($2)');
            expect(parameters).toEqual([['type-1'], ['venue-1']]);
        });

        it('should include HAVING clause in COUNT query', () => {
            const { sql } = queryBuilder.buildCountQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {}
            );

            expect(sql).toContain('HAVING');
            expect(sql).toContain('COUNT(DISTINCT fa.id) > 0');
        });
    });

    describe('Query Structure', () => {
        it('should have correct CTE order', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {}
            );

            const areaDescIndex = sql.indexOf('area_descendants');
            const filteredActIndex = sql.indexOf('filtered_activities');
            const areaMetricsIndex = sql.indexOf('area_metrics');

            expect(areaDescIndex).toBeLessThan(filteredActIndex);
            expect(filteredActIndex).toBeLessThan(areaMetricsIndex);
        });

        it('should have HAVING after GROUP BY', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {}
            );

            const groupByIndex = sql.indexOf('GROUP BY');
            const havingIndex = sql.indexOf('HAVING');

            expect(groupByIndex).toBeGreaterThan(0);
            expect(havingIndex).toBeGreaterThan(groupByIndex);
        });

        it('should have ORDER BY after HAVING', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {}
            );

            const havingIndex = sql.indexOf('HAVING');
            const orderByIndex = sql.indexOf('ORDER BY');

            expect(orderByIndex).toBeGreaterThan(havingIndex);
        });

        it('should have LIMIT/OFFSET after ORDER BY', () => {
            const { sql } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                {},
                { page: 1, pageSize: 10 }
            );

            const orderByIndex = sql.indexOf('ORDER BY');
            const limitIndex = sql.indexOf('LIMIT');

            expect(limitIndex).toBeGreaterThan(orderByIndex);
        });
    });

    describe('Parameter Handling', () => {
        it('should use parameterized queries for safety', () => {
            const filters: GeographicBreakdownFilters = {
                activityTypeIds: ['type-1'],
                activityCategoryIds: ['cat-1'],
                venueIds: ['venue-1'],
            };

            const { sql, parameters } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                filters
            );

            expect(sql).toContain('$1');
            expect(sql).toContain('$2');
            expect(sql).toContain('$3');
            expect(parameters).toHaveLength(3);
        });

        it('should handle date parameters correctly', () => {
            const filters: GeographicBreakdownFilters = {
                startDate: new Date('2024-01-01T00:00:00Z'),
                endDate: new Date('2024-12-31T23:59:59Z'),
            };

            const { parameters } = queryBuilder.buildGeographicBreakdownQuery(
                ['area-1'],
                new Map([['area-1', ['area-1']]]),
                filters
            );

            expect(parameters[0]).toBeInstanceOf(Date);
            expect(parameters[1]).toBeInstanceOf(Date);
        });
    });
});
