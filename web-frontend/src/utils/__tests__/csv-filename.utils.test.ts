import { describe, it, expect } from 'vitest';
import { generateEngagementSummaryFilename } from '../csv-filename.utils';
import type { GeographicArea } from '../../types';

describe('CSV Filename Utilities', () => {
  describe('generateEngagementSummaryFilename', () => {
    it('should generate basic filename with only current date when no filters active', () => {
      const filename = generateEngagementSummaryFilename({});

      // Should match pattern: engagement-summary_YYYY-MM-DD.csv
      expect(filename).toMatch(/^engagement-summary_\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it('should include geographic area name and type when filter is active', () => {
      const geographicArea: GeographicArea = {
        id: '1',
        name: 'Vancouver',
        areaType: 'CITY',
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const filename = generateEngagementSummaryFilename({ geographicArea });

      // Should include Vancouver-City
      expect(filename).toMatch(/^engagement-summary_Vancouver-City_\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it('should format multi-word area types with hyphens in title case', () => {
      const geographicArea: GeographicArea = {
        id: '1',
        name: 'Downtown',
        areaType: 'NEIGHBOURHOOD',
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const filename = generateEngagementSummaryFilename({ geographicArea });

      // Should include Downtown-Neighbourhood (not NEIGHBOURHOOD or neighbourhood)
      expect(filename).toContain('Downtown-Neighbourhood');
    });

    it('should include date range when active', () => {
      const filename = generateEngagementSummaryFilename({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });

      // Should include both dates but NOT the current date suffix
      expect(filename).toContain('2025-01-01');
      expect(filename).toContain('2025-12-31');
      expect(filename).toBe('engagement-summary_2025-01-01_2025-12-31.csv');
    });

    it('should include activity category name when filter is active', () => {
      const filename = generateEngagementSummaryFilename({
        activityCategoryName: 'Study Circles',
      });

      // Should include sanitized category name
      expect(filename).toContain('Study-Circles');
    });

    it('should include activity type name when filter is active', () => {
      const filename = generateEngagementSummaryFilename({
        activityTypeName: 'Book 1',
      });

      // Should include sanitized type name
      expect(filename).toContain('Book-1');
    });

    it('should include venue name when filter is active', () => {
      const filename = generateEngagementSummaryFilename({
        venueName: 'Community Center',
      });

      // Should include sanitized venue name
      expect(filename).toContain('Community-Center');
    });

    it('should include population names when filter is active', () => {
      const filename = generateEngagementSummaryFilename({
        populationNames: ['Youth', 'Adults'],
      });

      // Should include both population names joined with hyphen
      expect(filename).toContain('Youth-Adults');
    });

    it('should sanitize filter values by removing invalid filename characters', () => {
      const filename = generateEngagementSummaryFilename({
        activityCategoryName: 'Test: Category / With * Invalid ? Characters',
      });

      // Should remove colons, slashes, asterisks, question marks
      expect(filename).not.toContain(':');
      expect(filename).not.toContain('/');
      expect(filename).not.toContain('*');
      expect(filename).not.toContain('?');
      expect(filename).toContain('Test-Category-With-Invalid-Characters');
    });

    it('should omit inactive filters to keep filename concise', () => {
      const filename = generateEngagementSummaryFilename({
        activityCategoryName: 'Study Circles',
        // No date range, venue, or other filters
      });

      // Should only include category and current date
      expect(filename).toMatch(/^engagement-summary_Study-Circles_\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it('should generate comprehensive filename with all filters active', () => {
      const geographicArea: GeographicArea = {
        id: '1',
        name: 'Vancouver',
        areaType: 'CITY',
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const filename = generateEngagementSummaryFilename({
        geographicArea,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        activityCategoryName: 'Study Circles',
        activityTypeName: 'Book 1',
        venueName: 'Community Center',
        populationNames: ['Youth'],
      });

      // Should include all filter components but NOT current date (date range is active)
      expect(filename).toContain('Vancouver-City');
      expect(filename).toContain('Study-Circles');
      expect(filename).toContain('Book-1');
      expect(filename).toContain('Community-Center');
      expect(filename).toContain('Youth');
      expect(filename).toContain('2025-01-01');
      expect(filename).toContain('2025-12-31');

      // Should separate components with underscores and NOT include current date
      expect(filename).toBe('engagement-summary_Vancouver-City_Study-Circles_Book-1_Community-Center_Youth_2025-01-01_2025-12-31.csv');
    });

    it('should handle geographic areas with spaces in name', () => {
      const geographicArea: GeographicArea = {
        id: '1',
        name: 'North Vancouver',
        areaType: 'CITY',
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const filename = generateEngagementSummaryFilename({ geographicArea });

      // Should replace spaces with hyphens
      expect(filename).toContain('North-Vancouver-City');
    });

    it('should format different area types correctly', () => {
      const testCases: Array<{ areaType: string; expected: string }> = [
        { areaType: 'NEIGHBOURHOOD', expected: 'Neighbourhood' },
        { areaType: 'COMMUNITY', expected: 'Community' },
        { areaType: 'CITY', expected: 'City' },
        { areaType: 'PROVINCE', expected: 'Province' },
        { areaType: 'COUNTRY', expected: 'Country' },
      ];

      testCases.forEach(({ areaType, expected }) => {
        const geographicArea: GeographicArea = {
          id: '1',
          name: 'TestArea',
          areaType: areaType as any,
          version: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };

        const filename = generateEngagementSummaryFilename({ geographicArea });
        expect(filename).toContain(`TestArea-${expected}`);
      });
    });

    it('should include calculated dates from relative date range', () => {
      // Test that when startDate and endDate are provided (calculated from relative range),
      // they appear in the filename WITHOUT the current date suffix
      const filename = generateEngagementSummaryFilename({
        startDate: '2025-10-06',
        endDate: '2026-01-06',
      });

      // Should include both calculated dates but NOT current date
      expect(filename).toContain('2025-10-06');
      expect(filename).toContain('2026-01-06');
      expect(filename).toBe('engagement-summary_2025-10-06_2026-01-06.csv');
    });
  });
});
