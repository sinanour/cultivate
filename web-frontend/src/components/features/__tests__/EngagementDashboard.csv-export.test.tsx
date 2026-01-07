import { describe, it, expect } from 'vitest';
import { generateEngagementSummaryFilename } from '../../../utils/csv-filename.utils';
import type { GeographicArea } from '../../../types';

describe('EngagementDashboard CSV Export Integration', () => {
  describe('Filename generation with relative date ranges', () => {
    it('should include calculated dates when relative date range is used', () => {
      // Simulate a relative date range of "Last 90 days"
      const now = new Date('2026-01-06T12:00:00Z');
      const end = new Date(now);
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      
      const startDate = start.toISOString().split('T')[0]; // 2025-10-08
      const endDate = end.toISOString().split('T')[0];     // 2026-01-06
      
      const filename = generateEngagementSummaryFilename({
        startDate,
        endDate,
      });
      
      // Should include both calculated dates but NOT current date suffix
      expect(filename).toContain('2025-10-08');
      expect(filename).toContain('2026-01-06');
      expect(filename).toBe('engagement-summary_2025-10-08_2026-01-06.csv');
    });

    it('should include calculated dates with geographic area filter', () => {
      const geographicArea: GeographicArea = {
        id: '1',
        name: 'Vancouver',
        areaType: 'CITY',
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      // Simulate relative date range calculation
      const now = new Date('2026-01-06T12:00:00Z');
      const end = new Date(now);
      const start = new Date(now);
      start.setMonth(start.getMonth() - 6); // Last 6 months
      
      const startDate = start.toISOString().split('T')[0];
      const endDate = end.toISOString().split('T')[0];
      
      const filename = generateEngagementSummaryFilename({
        geographicArea,
        startDate,
        endDate,
      });
      
      // Should include geographic area and calculated dates
      expect(filename).toContain('Vancouver-City');
      expect(filename).toContain(startDate);
      expect(filename).toContain(endDate);
    });

    it('should handle relative date range with all filters', () => {
      const geographicArea: GeographicArea = {
        id: '1',
        name: 'Downtown',
        areaType: 'NEIGHBOURHOOD',
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      // Simulate relative date range calculation (last 30 days)
      const now = new Date('2026-01-06T12:00:00Z');
      const end = new Date(now);
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      
      const startDate = start.toISOString().split('T')[0];
      const endDate = end.toISOString().split('T')[0];
      
      const filename = generateEngagementSummaryFilename({
        geographicArea,
        startDate,
        endDate,
        activityCategoryName: 'Study Circles',
        populationNames: ['Youth'],
      });
      
      // Should include all components
      expect(filename).toContain('Downtown-Neighbourhood');
      expect(filename).toContain('Study-Circles');
      expect(filename).toContain('Youth');
      expect(filename).toContain(startDate);
      expect(filename).toContain(endDate);
    });
  });
});
