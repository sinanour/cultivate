import type { GeographicArea } from '../types';

/**
 * Sanitize a string for use in a filename by replacing spaces with hyphens
 * and removing invalid filename characters
 */
function sanitizeForFilename(value: string): string {
  return value
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[:/\\*?"<>|]/g, '') // Remove invalid filename characters
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Format geographic area type for filename (title case with hyphens for multi-word types)
 */
function formatAreaType(areaType: string): string {
  // Convert from SCREAMING_SNAKE_CASE to Title-Case
  return areaType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('-');
}

/**
 * Generate filename for Engagement Summary CSV export with active filters
 */
export function generateEngagementSummaryFilename(options: {
  geographicArea?: GeographicArea | null;
  startDate?: string;
  endDate?: string;
  activityCategoryName?: string;
  activityTypeName?: string;
  venueName?: string;
  populationNames?: string[];
}): string {
  const segments: string[] = ['engagement-summary'];

  // Add geographic area filter (name-type format)
  if (options.geographicArea) {
    const areaName = sanitizeForFilename(options.geographicArea.name);
    const areaType = formatAreaType(options.geographicArea.areaType);
    segments.push(`${areaName}-${areaType}`);
  }

  // Add activity category filter
  if (options.activityCategoryName) {
    segments.push(sanitizeForFilename(options.activityCategoryName));
  }

  // Add activity type filter
  if (options.activityTypeName) {
    segments.push(sanitizeForFilename(options.activityTypeName));
  }

  // Add venue filter
  if (options.venueName) {
    segments.push(sanitizeForFilename(options.venueName));
  }

  // Add population filters (join multiple with hyphens)
  if (options.populationNames && options.populationNames.length > 0) {
    const populationSegment = options.populationNames
      .map(name => sanitizeForFilename(name))
      .join('-');
    segments.push(populationSegment);
  }

  // Track if date range filter is active
  const hasDateRangeFilter = options.startDate && options.endDate;

  // Add date range filter
  if (hasDateRangeFilter) {
    segments.push(options.startDate!); // Already in YYYY-MM-DD format (non-null asserted)
    segments.push(options.endDate!);   // Already in YYYY-MM-DD format (non-null asserted)
  }

  // Add current date only when no date range filter is active (exporting all history)
  if (!hasDateRangeFilter) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    segments.push(today);
  }

  // Join with underscores and add extension
  return `${segments.join('_')}.csv`;
}
