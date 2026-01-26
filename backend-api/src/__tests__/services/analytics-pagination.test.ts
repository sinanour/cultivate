import { PrismaClient } from '@prisma/client';
import { QueryBuilder, GroupingDimension } from '../../services/analytics/query-builder';
import { WireFormatTransformer } from '../../services/analytics/wire-format-transformer';
import { OptimizedAnalyticsService } from '../../services/analytics/optimized-analytics.service';

describe('Analytics Pagination and Zero-Row Filtering', () => {
  let prisma: PrismaClient;
  let queryBuilder: QueryBuilder;
  let wireFormatTransformer: WireFormatTransformer;
  let optimizedAnalyticsService: OptimizedAnalyticsService;

  beforeAll(() => {
    prisma = new PrismaClient();
    queryBuilder = new QueryBuilder(prisma);
    wireFormatTransformer = new WireFormatTransformer();
    optimizedAnalyticsService = new OptimizedAnalyticsService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('HAVING Clause Generation', () => {
    it('should generate HAVING clause for no date range', () => {
      const { sql } = queryBuilder.buildEngagementQuery(
        {},
        [GroupingDimension.ACTIVITY_TYPE]
      );

      expect(sql).toContain('HAVING');
      // HAVING clause uses aggregate expressions, not aliases
      expect(sql).toContain('COUNT(DISTINCT fa.id)');
      expect(sql).toContain('COUNT(DISTINCT asn."participantId")');
      expect(sql).toContain('COUNT(asn.id)');
      expect(sql).toContain('> 0');
      expect(sql).toContain('fa."activityTypeId" IS NULL');
    });

    it('should generate HAVING clause for date range', () => {
      const { sql } = queryBuilder.buildEngagementQuery(
        {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
        },
        [GroupingDimension.ACTIVITY_TYPE]
      );

      expect(sql).toContain('HAVING');
      // HAVING clause uses aggregate expressions, not aliases
      expect(sql).toContain('COUNT(DISTINCT fa.id)');
      expect(sql).toContain('DATE(@startDate)');
      expect(sql).toContain('DATE(@endDate)');
      expect(sql).toContain('> 0');
    });

    it('should preserve total row in HAVING clause', () => {
      const { sql } = queryBuilder.buildEngagementQuery(
        {},
        [GroupingDimension.ACTIVITY_TYPE, GroupingDimension.ACTIVITY_CATEGORY]
      );

      expect(sql).toContain('fa."activityTypeId" IS NULL');
      expect(sql).toContain('fa."activityCategoryId" IS NULL');
    });

    it('should not add HAVING clause when no grouping', () => {
      const { sql } = queryBuilder.buildEngagementQuery({}, []);

      // No grouping means no GROUP BY, so no HAVING clause needed
      expect(sql).not.toContain('HAVING');
    });
  });

  describe('Pagination Clause Generation', () => {
    it('should generate LIMIT and OFFSET for pagination', () => {
      const { sql } = queryBuilder.buildEngagementQuery(
        {},
        [GroupingDimension.ACTIVITY_TYPE],
        { page: 2, pageSize: 50 }
      );

      expect(sql).toContain('LIMIT 50');
      expect(sql).toContain('OFFSET 50'); // (2-1) * 50 = 50
    });

    it('should calculate offset correctly for page 1', () => {
      const { sql } = queryBuilder.buildEngagementQuery(
        {},
        [GroupingDimension.ACTIVITY_TYPE],
        { page: 1, pageSize: 100 }
      );

      expect(sql).toContain('LIMIT 100');
      expect(sql).toContain('OFFSET 0'); // (1-1) * 100 = 0
    });

    it('should not add pagination clause when no pagination params', () => {
      const { sql } = queryBuilder.buildEngagementQuery(
        {},
        [GroupingDimension.ACTIVITY_TYPE]
      );

      expect(sql).not.toContain('LIMIT');
      expect(sql).not.toContain('OFFSET');
    });

    it('should use default values when only page is provided', () => {
      const { sql } = queryBuilder.buildEngagementQuery(
        {},
        [GroupingDimension.ACTIVITY_TYPE],
        { page: 3 }
      );

      expect(sql).toContain('LIMIT 100'); // default pageSize
      expect(sql).toContain('OFFSET 200'); // (3-1) * 100 = 200
    });
  });

  describe('COUNT Query Generation', () => {
    it('should wrap main query in COUNT subquery', () => {
      const { sql } = queryBuilder.buildCountQuery(
        {},
        [GroupingDimension.ACTIVITY_TYPE]
      );

      expect(sql).toContain('SELECT COUNT(*) as total FROM');
      expect(sql).toContain('AS count_query');
      expect(sql).toContain('WITH');
      expect(sql).toContain('filtered_activities');
      expect(sql).toContain('snapshot_metrics');
    });

    it('should include HAVING clause in COUNT query', () => {
      const { sql } = queryBuilder.buildCountQuery(
        {},
        [GroupingDimension.ACTIVITY_TYPE]
      );

      expect(sql).toContain('HAVING');
      // HAVING clause uses aggregate expressions, not aliases
      expect(sql).toContain('COUNT(DISTINCT fa.id)');
      expect(sql).toContain('> 0');
    });

    it('should not include LIMIT/OFFSET in COUNT query', () => {
      const { sql } = queryBuilder.buildCountQuery(
        {},
        [GroupingDimension.ACTIVITY_TYPE]
      );

      expect(sql).not.toContain('LIMIT');
      expect(sql).not.toContain('OFFSET');
    });
  });

  describe('Pagination Metadata Calculation', () => {
    it('should calculate pagination metadata correctly', () => {
      const mockResults = [
        { activityTypeId: 'type-1', activeActivities: 5, uniqueParticipants: 10, totalParticipation: 15 },
        { activityTypeId: 'type-2', activeActivities: 3, uniqueParticipants: 8, totalParticipation: 12 },
      ];

      const mockLookups = {
        activityTypes: new Map([['type-1', 'Type 1'], ['type-2', 'Type 2']]),
        activityCategories: new Map(),
        geographicAreas: new Map(),
        venues: new Map(),
      };

      const wireFormat = wireFormatTransformer.transformToWireFormat(
        mockResults,
        mockLookups,
        [GroupingDimension.ACTIVITY_TYPE],
        false,
        150, // totalCount
        2,   // page
        50   // pageSize
      );

      expect(wireFormat.metadata.pagination).toEqual({
        page: 2,
        pageSize: 50,
        totalRecords: 150,
        totalPages: 3, // ceil(150 / 50)
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('should handle no pagination params (backward compatibility)', () => {
      const mockResults = [
        { activityTypeId: 'type-1', activeActivities: 5, uniqueParticipants: 10, totalParticipation: 15 },
      ];

      const mockLookups = {
        activityTypes: new Map([['type-1', 'Type 1']]),
        activityCategories: new Map(),
        geographicAreas: new Map(),
        venues: new Map(),
      };

      const wireFormat = wireFormatTransformer.transformToWireFormat(
        mockResults,
        mockLookups,
        [GroupingDimension.ACTIVITY_TYPE],
        false,
        1 // totalCount
      );

      expect(wireFormat.metadata.pagination).toEqual({
        page: 1,
        pageSize: 1,
        totalRecords: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should calculate hasNextPage correctly', () => {
      const mockResults: any[] = [];
      const mockLookups = {
        activityTypes: new Map(),
        activityCategories: new Map(),
        geographicAreas: new Map(),
        venues: new Map(),
      };

      // Last page
      const wireFormat1 = wireFormatTransformer.transformToWireFormat(
        mockResults,
        mockLookups,
        [],
        false,
        100,
        1,
        100
      );
      expect(wireFormat1.metadata.pagination.hasNextPage).toBe(false);

      // Not last page
      const wireFormat2 = wireFormatTransformer.transformToWireFormat(
        mockResults,
        mockLookups,
        [],
        false,
        200,
        1,
        100
      );
      expect(wireFormat2.metadata.pagination.hasNextPage).toBe(true);
    });
  });

  describe('Pagination Parameter Validation', () => {
    it('should reject negative page number', async () => {
      await expect(
        optimizedAnalyticsService.getEngagementMetrics(
          {},
          [],
          false,
          { page: -1, pageSize: 100 }
        )
      ).rejects.toThrow('page must be a positive integer');
    });

    it('should reject zero page number', async () => {
      await expect(
        optimizedAnalyticsService.getEngagementMetrics(
          {},
          [],
          false,
          { page: 0, pageSize: 100 }
        )
      ).rejects.toThrow('page must be a positive integer');
    });

    it('should reject pageSize less than 1', async () => {
      await expect(
        optimizedAnalyticsService.getEngagementMetrics(
          {},
          [],
          false,
          { page: 1, pageSize: 0 }
        )
      ).rejects.toThrow('pageSize must be between 1 and 1000');
    });

    it('should reject pageSize greater than 1000', async () => {
      await expect(
        optimizedAnalyticsService.getEngagementMetrics(
          {},
          [],
          false,
          { page: 1, pageSize: 1001 }
        )
      ).rejects.toThrow('pageSize must be between 1 and 1000');
    });

    it('should accept valid pagination parameters', async () => {
      // This should not throw
      await expect(
        optimizedAnalyticsService.getEngagementMetrics(
          {},
          [],
          false,
          { page: 1, pageSize: 100 }
        )
      ).resolves.toBeDefined();
    });
  });

  describe('Query Structure', () => {
    it('should place HAVING after GROUP BY and before ORDER BY', () => {
      const { sql } = queryBuilder.buildEngagementQuery(
        {},
        [GroupingDimension.ACTIVITY_TYPE]
      );

      const groupByIndex = sql.indexOf('GROUP BY');
      const havingIndex = sql.indexOf('HAVING');
      const orderByIndex = sql.indexOf('ORDER BY');

      expect(groupByIndex).toBeGreaterThan(-1);
      expect(havingIndex).toBeGreaterThan(groupByIndex);
      expect(orderByIndex).toBeGreaterThan(havingIndex);
    });

    it('should place LIMIT/OFFSET after ORDER BY', () => {
      const { sql } = queryBuilder.buildEngagementQuery(
        {},
        [GroupingDimension.ACTIVITY_TYPE],
        { page: 1, pageSize: 100 }
      );

      const orderByIndex = sql.indexOf('ORDER BY');
      const limitIndex = sql.indexOf('LIMIT');

      expect(orderByIndex).toBeGreaterThan(-1);
      expect(limitIndex).toBeGreaterThan(orderByIndex);
    });
  });
});
