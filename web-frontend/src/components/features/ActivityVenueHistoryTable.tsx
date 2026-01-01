import React from 'react';
import {
  Table,
  Box,
  Button,
  Badge,
  Link,
} from '@cloudscape-design/components';
import { formatDate } from '../../utils/date.utils';

interface ActivityVenueHistoryRecord {
  id: string;
  activityId: string;
  venueId: string;
  venue?: {
    id: string;
    name: string;
    address: string;
  };
  effectiveFrom: string | null;
  activity?: {
    startDate: string;
  };
}

interface ActivityVenueHistoryTableProps {
  venueHistory: ActivityVenueHistoryRecord[];
  activityStartDate?: string; // For displaying null dates
  onDelete: (venueHistoryId: string) => void;
  loading?: boolean;
}

export const ActivityVenueHistoryTable: React.FC<ActivityVenueHistoryTableProps> = ({
  venueHistory,
  activityStartDate,
  onDelete,
  loading = false,
}) => {

  // Sort by effective start date in reverse chronological order (most recent first)
  // Null dates (activity start) are treated using activityStartDate for sorting
  const sortedHistory = [...venueHistory].sort((a, b) => {
    const dateA = a.effectiveFrom || activityStartDate || '';
    const dateB = b.effectiveFrom || activityStartDate || '';
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  return (
    <Table
      columnDefinitions={[
        {
          id: 'venue',
          header: 'Venue',
          cell: (item: ActivityVenueHistoryRecord) => (
            <Box>
              <Link href={`/venues/${item.venueId}`}>
                {item.venue?.name || 'Unknown Venue'}
              </Link>
              {sortedHistory.indexOf(item) === 0 && (
                <Box margin={{ left: 'xs' }} display="inline-block">
                  <Badge color="green">Current</Badge>
                </Box>
              )}
            </Box>
          ),
          sortingField: 'venue.name',
        },
        {
          id: 'address',
          header: 'Address',
          cell: (item: ActivityVenueHistoryRecord) => item.venue?.address || 'N/A',
        },
        {
          id: 'effectiveFrom',
          header: 'Effective From',
          cell: (item: ActivityVenueHistoryRecord) => 
            item.effectiveFrom ? formatDate(item.effectiveFrom) : (
              <Box>
                <Badge color="blue">Since Activity Start</Badge>
                {activityStartDate && (
                  <Box variant="small" color="text-body-secondary" margin={{ top: 'xxxs' }}>
                    ({formatDate(activityStartDate)})
                  </Box>
                )}
              </Box>
            ),
          sortingField: 'effectiveFrom',
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: (item: ActivityVenueHistoryRecord) => (
            <Button
              variant="inline-link"
              onClick={() => onDelete(item.id)}
            >
              Delete
            </Button>
          ),
        },
      ]}
      items={sortedHistory}
      loading={loading}
      loadingText="Loading venue history"
      empty={
        <Box textAlign="center" color="inherit">
          <b>No venue history</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            No venue history records found for this activity.
          </Box>
        </Box>
      }
    />
  );
};
