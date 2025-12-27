import React, { useState } from 'react';
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
  effectiveFrom: string;
}

interface ActivityVenueHistoryTableProps {
  venueHistory: ActivityVenueHistoryRecord[];
  onDelete: (venueId: string) => void;
  loading?: boolean;
}

export const ActivityVenueHistoryTable: React.FC<ActivityVenueHistoryTableProps> = ({
  venueHistory,
  onDelete,
  loading = false,
}) => {
  const [selectedItems, setSelectedItems] = useState<ActivityVenueHistoryRecord[]>([]);

  // Sort by effective start date in reverse chronological order (most recent first)
  const sortedHistory = [...venueHistory].sort((a, b) => {
    return new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime();
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
          cell: (item: ActivityVenueHistoryRecord) => formatDate(item.effectiveFrom),
          sortingField: 'effectiveFrom',
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: (item: ActivityVenueHistoryRecord) => (
            <Button
              variant="inline-link"
              onClick={() => onDelete(item.venueId)}
            >
              Delete
            </Button>
          ),
        },
      ]}
      items={sortedHistory}
      loading={loading}
      loadingText="Loading venue history"
      selectionType="single"
      selectedItems={selectedItems}
      onSelectionChange={({ detail }) =>
        setSelectedItems(detail.selectedItems)
      }
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
