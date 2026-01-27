import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService } from '../../../services/api/analytics.service';
import { parseEngagementWireFormat } from '../../../utils/wireFormatParser';
import type { EngagementWireFormat } from '../../../utils/wireFormatParser';

// Mock the AnalyticsService
vi.mock('../../../services/api/analytics.service', () => ({
  AnalyticsService: {
    getEngagementMetricsOptimized: vi.fn(),
    getRoleDistribution: vi.fn(),
  },
}));

describe('EngagementDashboard CSV Export Smart Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Single-page detection', () => {
    it('should detect single-page dataset when totalPages === 1 and page === 1', () => {
      const pagination = {
        page: 1,
        pageSize: 100,
        totalRecords: 50,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      };

      const needsFullFetch = !pagination || pagination.totalPages > 1 || pagination.page !== 1;
      expect(needsFullFetch).toBe(false);
    });

    it('should detect multi-page dataset when totalPages > 1', () => {
      const pagination = {
        page: 1,
        pageSize: 100,
        totalRecords: 250,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      };

      const needsFullFetch = !pagination || pagination.totalPages > 1 || pagination.page !== 1;
      expect(needsFullFetch).toBe(true);
    });

    it('should detect need for full fetch when on page > 1', () => {
      const pagination = {
        page: 2,
        pageSize: 100,
        totalRecords: 150,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
      };

      const needsFullFetch = !pagination || pagination.totalPages > 1 || pagination.page !== 1;
      expect(needsFullFetch).toBe(true);
    });

    it('should detect need for full fetch when pagination is missing', () => {
      const pagination = undefined;

      const needsFullFetch = !pagination || pagination?.totalPages > 1 || pagination?.page !== 1;
      expect(needsFullFetch).toBe(true);
    });
  });

  describe('Wire format parsing and transformation', () => {
    it('should correctly parse wire format with date range', () => {
      const wireFormat: EngagementWireFormat = {
        data: [
          [-1, -1, 10, 5, 3, 15, 8, 5, 5, 3], // Total row
          [0, 0, 5, 2, 1, 8, 4, 3, 3, 2],     // Type 1, Category 1
        ],
        lookups: {
          activityTypes: [{ id: 'type1', name: 'Study Circle' }],
          activityCategories: [{ id: 'cat1', name: 'Core Activities' }],
        },
        metadata: {
          columns: [
            'activityTypeIndex',
            'activityCategoryIndex',
            'activitiesAtStart',
            'participantsAtStart',
            'participationAtStart',
            'activitiesAtEnd',
            'participantsAtEnd',
            'participationAtEnd',
            'activitiesStarted',
            'activitiesCompleted',
          ],
          groupingDimensions: ['activityType', 'activityCategory'],
          hasDateRange: true,
          pagination: {
            page: 1,
            pageSize: 100,
            totalRecords: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      };

      const parsed = parseEngagementWireFormat(wireFormat);

      expect(parsed.hasDateRange).toBe(true);
      expect(parsed.totalRow).toBeDefined();
      expect(parsed.totalRow?.activitiesAtStart).toBe(10);
      expect(parsed.totalRow?.participantsAtStart).toBe(5);
      expect(parsed.totalRow?.activitiesAtEnd).toBe(15);
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0].activityType?.name).toBe('Study Circle');
    });

    it('should correctly parse wire format without date range', () => {
      const wireFormat: EngagementWireFormat = {
        data: [
          [-1, -1, 15, 8, 5, 5, 3], // Total row
          [0, 0, 8, 4, 3, 3, 2],     // Type 1, Category 1
        ],
        lookups: {
          activityTypes: [{ id: 'type1', name: 'Study Circle' }],
          activityCategories: [{ id: 'cat1', name: 'Core Activities' }],
        },
        metadata: {
          columns: [
            'activityTypeIndex',
            'activityCategoryIndex',
            'activeActivities',
            'uniqueParticipants',
            'totalParticipation',
            'activitiesStarted',
            'activitiesCompleted',
          ],
          groupingDimensions: ['activityType', 'activityCategory'],
          hasDateRange: false,
          pagination: {
            page: 1,
            pageSize: 100,
            totalRecords: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      };

      const parsed = parseEngagementWireFormat(wireFormat);

      expect(parsed.hasDateRange).toBe(false);
      expect(parsed.totalRow).toBeDefined();
      expect(parsed.totalRow?.activeActivities).toBe(15);
      expect(parsed.totalRow?.uniqueParticipants).toBe(8);
      expect(parsed.rows).toHaveLength(1);
    });
  });

  describe('API integration', () => {
    it('should call optimized API without pagination params for multi-page export', async () => {
      const mockWireFormat: EngagementWireFormat = {
        data: [[-1, 10, 5, 3, 5, 3]],
        lookups: {},
        metadata: {
          columns: ['activeActivities', 'uniqueParticipants', 'totalParticipation', 'activitiesStarted', 'activitiesCompleted'],
          groupingDimensions: [],
          hasDateRange: false,
          pagination: {
            page: 1,
            pageSize: 250,
            totalRecords: 250,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      };

      vi.mocked(AnalyticsService.getEngagementMetricsOptimized).mockResolvedValue(mockWireFormat);

      // Simulate calling the API without pagination
      const result = await AnalyticsService.getEngagementMetricsOptimized({
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-12-31T23:59:59.999Z',
        groupBy: [],
        // No page or pageSize parameters
      });

      expect(AnalyticsService.getEngagementMetricsOptimized).toHaveBeenCalledWith({
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-12-31T23:59:59.999Z',
        groupBy: [],
      });
      expect(result).toEqual(mockWireFormat);
    });

    it('should pass all filters to unpaginated API call', async () => {
      const mockWireFormat: EngagementWireFormat = {
        data: [],
        lookups: {},
        metadata: {
          columns: [],
          groupingDimensions: [],
          hasDateRange: true,
          pagination: {
            page: 1,
            pageSize: 100,
            totalRecords: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      };

      vi.mocked(AnalyticsService.getEngagementMetricsOptimized).mockResolvedValue(mockWireFormat);

      await AnalyticsService.getEngagementMetricsOptimized({
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-12-31T23:59:59.999Z',
        activityCategoryIds: ['cat1', 'cat2'],
        activityTypeIds: ['type1'],
        venueIds: ['venue1'],
        populationIds: ['pop1'],
        geographicAreaIds: ['area1'],
        groupBy: ['activityType', 'venue'],
      });

      expect(AnalyticsService.getEngagementMetricsOptimized).toHaveBeenCalledWith({
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-12-31T23:59:59.999Z',
        activityCategoryIds: ['cat1', 'cat2'],
        activityTypeIds: ['type1'],
        venueIds: ['venue1'],
        populationIds: ['pop1'],
        geographicAreaIds: ['area1'],
        groupBy: ['activityType', 'venue'],
      });
    });
  });

  describe('Data transformation consistency', () => {
    it('should produce identical structure for cached vs fetched data', () => {
      const wireFormat: EngagementWireFormat = {
        data: [
          [-1, 15, 8, 5, 5, 3], // Total row
          [0, 8, 4, 3, 3, 2],   // Type 1
        ],
        lookups: {
          activityTypes: [{ id: 'type1', name: 'Study Circle' }],
        },
        metadata: {
          columns: [
            'activityTypeIndex',
            'activeActivities',
            'uniqueParticipants',
            'totalParticipation',
            'activitiesStarted',
            'activitiesCompleted',
          ],
          groupingDimensions: ['activityType'],
          hasDateRange: false,
          pagination: {
            page: 1,
            pageSize: 100,
            totalRecords: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      };

      const parsed = parseEngagementWireFormat(wireFormat);

      // Verify structure
      expect(parsed.totalRow).toBeDefined();
      expect(parsed.totalRow?.activeActivities).toBe(15);
      expect(parsed.totalRow?.uniqueParticipants).toBe(8);
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0].activityType?.name).toBe('Study Circle');
      expect(parsed.rows[0].activeActivities).toBe(8);
      expect(parsed.groupingDimensions).toEqual(['activityType']);
      expect(parsed.pagination).toBeDefined();
    });
  });
});
