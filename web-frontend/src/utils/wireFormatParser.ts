export interface EngagementWireFormat {
    data: Array<Array<number>>;
    lookups: {
        activityTypes?: Array<{ id: string; name: string }>;
        activityCategories?: Array<{ id: string; name: string }>;
        geographicAreas?: Array<{ id: string; name: string }>;
        venues?: Array<{ id: string; name: string }>;
    };
    metadata: {
        columns: string[];
        groupingDimensions: string[];
        hasDateRange: boolean;
        pagination?: {
            page: number;
            pageSize: number;
            totalRecords: number;
            totalPages: number;
            hasNextPage: boolean;
            hasPreviousPage: boolean;
        };
    };
}

export interface ParsedEngagementRow {
    activityType?: { id: string; name: string } | null;
    activityCategory?: { id: string; name: string } | null;
    geographicArea?: { id: string; name: string } | null;
    venue?: { id: string; name: string } | null;
    activeActivities?: number;
    uniqueParticipants?: number;
    totalParticipation?: number;
    activitiesAtStart?: number;
    participantsAtStart?: number;
    participationAtStart?: number;
    activitiesAtEnd?: number;
    participantsAtEnd?: number;
    participationAtEnd?: number;
    activitiesStarted?: number;
    activitiesCompleted?: number;
}

export interface ParsedEngagementData {
    rows: ParsedEngagementRow[];
    totalRow?: ParsedEngagementRow;
    hasDateRange: boolean;
    groupingDimensions: string[];
    pagination?: {
        page: number;
        pageSize: number;
        totalRecords: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

/**
 * Parse wire format engagement data into human-readable objects
 */
export function parseEngagementWireFormat(wireFormat: EngagementWireFormat): ParsedEngagementData {
    const { data, lookups, metadata } = wireFormat;
    const { groupingDimensions, hasDateRange } = metadata;

    const rows: ParsedEngagementRow[] = [];
    let totalRow: ParsedEngagementRow | undefined;

    for (const dataRow of data) {
        const parsedRow: ParsedEngagementRow = {};
        let colIndex = 0;

      // Parse dimension indexes
      if (groupingDimensions.includes('activityType')) {
          const typeIndex = dataRow[colIndex++];
          if (typeIndex === -1) {
              parsedRow.activityType = null; // Aggregated
          } else if (lookups.activityTypes && typeIndex >= 0 && typeIndex < lookups.activityTypes.length) {
              parsedRow.activityType = lookups.activityTypes[typeIndex];
          }
      }

      if (groupingDimensions.includes('activityCategory')) {
          const categoryIndex = dataRow[colIndex++];
          if (categoryIndex === -1) {
              parsedRow.activityCategory = null; // Aggregated
          } else if (lookups.activityCategories && categoryIndex >= 0 && categoryIndex < lookups.activityCategories.length) {
              parsedRow.activityCategory = lookups.activityCategories[categoryIndex];
          }
      }

      if (groupingDimensions.includes('geographicArea')) {
          const areaIndex = dataRow[colIndex++];
          if (areaIndex === -1) {
              parsedRow.geographicArea = null; // Aggregated
          } else if (lookups.geographicAreas && areaIndex >= 0 && areaIndex < lookups.geographicAreas.length) {
              parsedRow.geographicArea = lookups.geographicAreas[areaIndex];
          }
      }

        if (groupingDimensions.includes('venue')) {
            const venueIndex = dataRow[colIndex++];
            if (venueIndex === -1) {
                parsedRow.venue = null; // Aggregated
            } else if (lookups.venues && venueIndex >= 0 && venueIndex < lookups.venues.length) {
                parsedRow.venue = lookups.venues[venueIndex];
            }
        }

      // Parse metric values
      if (hasDateRange) {
          parsedRow.activitiesAtStart = dataRow[colIndex++];
          parsedRow.participantsAtStart = dataRow[colIndex++];
          parsedRow.participationAtStart = dataRow[colIndex++];
          parsedRow.activitiesAtEnd = dataRow[colIndex++];
          parsedRow.participantsAtEnd = dataRow[colIndex++];
          parsedRow.participationAtEnd = dataRow[colIndex++];
          parsedRow.activitiesStarted = dataRow[colIndex++];
          parsedRow.activitiesCompleted = dataRow[colIndex++];
      } else {
          // Current date: 5 metrics (active snapshot + lifecycle events)
          parsedRow.activeActivities = dataRow[colIndex++];
          parsedRow.uniqueParticipants = dataRow[colIndex++];
          parsedRow.totalParticipation = dataRow[colIndex++];
          parsedRow.activitiesStarted = dataRow[colIndex++];
          parsedRow.activitiesCompleted = dataRow[colIndex++];
      }

      // Check if this is the total row (all dimensions are -1 or null)
      const isTotalRow =
          (!groupingDimensions.includes('activityType') || parsedRow.activityType === null) &&
          (!groupingDimensions.includes('activityCategory') || parsedRow.activityCategory === null) &&
          (!groupingDimensions.includes('geographicArea') || parsedRow.geographicArea === null) &&
          (!groupingDimensions.includes('venue') || parsedRow.venue === null);

      if (isTotalRow) {
          totalRow = parsedRow;
      } else {
          rows.push(parsedRow);
      }
  }

    return {
        rows,
        totalRow,
        hasDateRange,
        groupingDimensions,
        pagination: metadata.pagination,
    };
}
