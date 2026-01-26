import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseEngagementWireFormat, type EngagementWireFormat } from '../../../utils/wireFormatParser';

describe('EngagementDashboard - Optimized Endpoint Integration', () => {
  describe('Wire format parsing', () => {
    it('should correctly parse wire format with date range', () => {
      const wireFormat: EngagementWireFormat = {
        data: [
          // Total row: all dimensions are -1
          [-1, -1, 100, 50, 200, 120, 60, 220, 20, 10],
          // Type 1, Category 0
          [0, 0, 40, 20, 80, 50, 25, 90, 10, 5],
          // Type 2, Category 1
          [1, 1, 60, 30, 120, 70, 35, 130, 10, 5],
        ],
        lookups: {
          activityTypes: [
            { id: 'type-1', name: 'Study Circle' },
            { id: 'type-2', name: "Children's Class" },
          ],
          activityCategories: [
            { id: 'cat-1', name: 'Core Activities' },
            { id: 'cat-2', name: 'Educational Programs' },
          ],
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
        },
      };

      const parsed = parseEngagementWireFormat(wireFormat);

      // Verify total row
      expect(parsed.totalRow).toBeDefined();
      expect(parsed.totalRow?.activitiesAtStart).toBe(100);
      expect(parsed.totalRow?.participantsAtStart).toBe(50);
      expect(parsed.totalRow?.participationAtStart).toBe(200);
      expect(parsed.totalRow?.activitiesAtEnd).toBe(120);
      expect(parsed.totalRow?.participantsAtEnd).toBe(60);
      expect(parsed.totalRow?.participationAtEnd).toBe(220);
      expect(parsed.totalRow?.activitiesStarted).toBe(20);
      expect(parsed.totalRow?.activitiesCompleted).toBe(10);

      // Verify detail rows
      expect(parsed.rows).toHaveLength(2);
      
      const row1 = parsed.rows[0];
      expect(row1.activityType?.name).toBe('Study Circle');
      expect(row1.activityCategory?.name).toBe('Core Activities');
      expect(row1.activitiesAtStart).toBe(40);
      expect(row1.participantsAtStart).toBe(20);
      expect(row1.activitiesStarted).toBe(10);

      const row2 = parsed.rows[1];
      expect(row2.activityType?.name).toBe("Children's Class");
      expect(row2.activityCategory?.name).toBe('Educational Programs');
      expect(row2.activitiesAtEnd).toBe(70);
      expect(row2.participantsAtEnd).toBe(35);
      expect(row2.activitiesCompleted).toBe(5);

      // Verify metadata
      expect(parsed.hasDateRange).toBe(true);
      expect(parsed.groupingDimensions).toEqual(['activityType', 'activityCategory']);
    });

    it('should correctly parse wire format without date range', () => {
      const wireFormat: EngagementWireFormat = {
        data: [
          // Total row
          [-1, 150, 75, 300],
          // Type 1
          [0, 60, 30, 120],
          // Type 2
          [1, 90, 45, 180],
        ],
        lookups: {
          activityTypes: [
            { id: 'type-1', name: 'Study Circle' },
            { id: 'type-2', name: "Children's Class" },
          ],
        },
        metadata: {
          columns: [
            'activityTypeIndex',
            'activeActivities',
            'uniqueParticipants',
            'totalParticipation',
          ],
          groupingDimensions: ['activityType'],
          hasDateRange: false,
        },
      };

      const parsed = parseEngagementWireFormat(wireFormat);

      // Verify total row
      expect(parsed.totalRow).toBeDefined();
      expect(parsed.totalRow?.activeActivities).toBe(150);
      expect(parsed.totalRow?.uniqueParticipants).toBe(75);
      expect(parsed.totalRow?.totalParticipation).toBe(300);

      // Verify detail rows
      expect(parsed.rows).toHaveLength(2);
      
      const row1 = parsed.rows[0];
      expect(row1.activityType?.name).toBe('Study Circle');
      expect(row1.activeActivities).toBe(60);
      expect(row1.uniqueParticipants).toBe(30);
      expect(row1.totalParticipation).toBe(120);

      // Verify metadata
      expect(parsed.hasDateRange).toBe(false);
      expect(parsed.groupingDimensions).toEqual(['activityType']);
    });

    it('should handle empty results', () => {
      const wireFormat: EngagementWireFormat = {
        data: [
          // Only total row with zeros
          [-1, 0, 0, 0],
        ],
        lookups: {},
        metadata: {
          columns: ['activityTypeIndex', 'activeActivities', 'uniqueParticipants', 'totalParticipation'],
          groupingDimensions: ['activityType'],
          hasDateRange: false,
        },
      };

      const parsed = parseEngagementWireFormat(wireFormat);

      expect(parsed.totalRow).toBeDefined();
      expect(parsed.totalRow?.activeActivities).toBe(0);
      expect(parsed.rows).toHaveLength(0);
    });

    it('should handle geographic area grouping', () => {
      const wireFormat: EngagementWireFormat = {
        data: [
          // Total row
          [-1, 200, 100, 400],
          // Area 1
          [0, 120, 60, 240],
          // Area 2
          [1, 80, 40, 160],
        ],
        lookups: {
          geographicAreas: [
            { id: 'area-1', name: 'Vancouver' },
            { id: 'area-2', name: 'Toronto' },
          ],
        },
        metadata: {
          columns: [
            'geographicAreaIndex',
            'activeActivities',
            'uniqueParticipants',
            'totalParticipation',
          ],
          groupingDimensions: ['geographicArea'],
          hasDateRange: false,
        },
      };

      const parsed = parseEngagementWireFormat(wireFormat);

      expect(parsed.rows).toHaveLength(2);
      expect(parsed.rows[0].geographicArea?.name).toBe('Vancouver');
      expect(parsed.rows[0].activeActivities).toBe(120);
      expect(parsed.rows[1].geographicArea?.name).toBe('Toronto');
      expect(parsed.rows[1].activeActivities).toBe(80);
    });
  });

  describe('Backward compatibility transformation', () => {
    it('should transform parsed data to legacy format for table rendering', () => {
      const wireFormat: EngagementWireFormat = {
        data: [
          [-1, -1, 100, 50, 200, 120, 60, 220, 20, 10],
          [0, 0, 40, 20, 80, 50, 25, 90, 10, 5],
        ],
        lookups: {
          activityTypes: [{ id: 'type-1', name: 'Study Circle' }],
          activityCategories: [{ id: 'cat-1', name: 'Core Activities' }],
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
        },
      };

      const parsed = parseEngagementWireFormat(wireFormat);
      
      // Transform to legacy format (as done in EngagementDashboard)
      const legacyFormat = {
        activitiesAtStart: parsed.totalRow?.activitiesAtStart || 0,
        activitiesAtEnd: parsed.totalRow?.activitiesAtEnd || 0,
        activitiesStarted: parsed.totalRow?.activitiesStarted || 0,
        activitiesCompleted: parsed.totalRow?.activitiesCompleted || 0,
        participantsAtStart: parsed.totalRow?.participantsAtStart || 0,
        participantsAtEnd: parsed.totalRow?.participantsAtEnd || 0,
        participationAtStart: parsed.totalRow?.participationAtStart || 0,
        participationAtEnd: parsed.totalRow?.participationAtEnd || 0,
        groupedResults: parsed.rows.map(row => ({
          dimensions: {
            activityType: row.activityType?.name,
            activityTypeId: row.activityType?.id,
            activityCategory: row.activityCategory?.name,
            activityCategoryId: row.activityCategory?.id,
          },
          metrics: {
            activitiesAtStart: row.activitiesAtStart || 0,
            activitiesAtEnd: row.activitiesAtEnd || 0,
            activitiesStarted: row.activitiesStarted || 0,
            activitiesCompleted: row.activitiesCompleted || 0,
            participantsAtStart: row.participantsAtStart || 0,
            participantsAtEnd: row.participantsAtEnd || 0,
            participationAtStart: row.participationAtStart || 0,
            participationAtEnd: row.participationAtEnd || 0,
          },
        })),
      };

      // Verify transformation
      expect(legacyFormat.activitiesAtStart).toBe(100);
      expect(legacyFormat.participantsAtEnd).toBe(60);
      expect(legacyFormat.groupedResults).toHaveLength(1);
      expect(legacyFormat.groupedResults[0].dimensions.activityType).toBe('Study Circle');
      expect(legacyFormat.groupedResults[0].metrics.activitiesAtEnd).toBe(50);
    });
  });
});
