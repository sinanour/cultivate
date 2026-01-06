import React from 'react';
import {
  Table,
  Box,
  Button,
  SpaceBetween,
  Badge,
  Link,
} from '@cloudscape-design/components';
import type { ParticipantAddressHistory } from '../../types';
import { formatDate } from '../../utils/date.utils';

interface AddressHistoryTableProps {
  addressHistory: ParticipantAddressHistory[];
  onEdit: (record: ParticipantAddressHistory) => void;
  onDelete: (recordId: string) => void;
  loading?: boolean;
  header?: React.ReactNode;
}

export const AddressHistoryTable: React.FC<AddressHistoryTableProps> = ({
  addressHistory,
  onEdit,
  onDelete,
  loading = false,
  header,
}) => {

  // Sort by effective start date in reverse chronological order (most recent first)
  // Null dates (initial address) sort to the end (oldest)
  const sortedHistory = [...addressHistory].sort((a, b) => {
    if (a.effectiveFrom === null && b.effectiveFrom === null) return 0;
    if (a.effectiveFrom === null) return 1; // null goes to end (oldest)
    if (b.effectiveFrom === null) return -1; // null goes to end (oldest)
    return new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime();
  });

  return (
    <Table
      header={header}
      columnDefinitions={[
        {
          id: 'venue',
          header: 'Venue',
          cell: (item: ParticipantAddressHistory) => (
            <SpaceBetween direction="horizontal" size="xs">
              <Link href={`/venues/${item.venueId}`}>
                {item.venue?.name || 'Unknown Venue'}
              </Link>
              {sortedHistory.indexOf(item) === 0 && (
                <Badge color="green">Current</Badge>
              )}
            </SpaceBetween>
          ),
          sortingField: 'venue.name',
        },
        {
          id: 'address',
          header: 'Address',
          cell: (item: ParticipantAddressHistory) => item.venue?.address || 'N/A',
        },
        {
          id: 'effectiveFrom',
          header: 'Effective From',
          cell: (item: ParticipantAddressHistory) => 
            item.effectiveFrom ? formatDate(item.effectiveFrom) : (
              <Box>
                <Badge color="blue">Initial Address</Badge>
              </Box>
            ),
          sortingField: 'effectiveFrom',
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: (item: ParticipantAddressHistory) => (
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="inline-link"
                onClick={() => onEdit(item)}
              >
                Edit
              </Button>
              <Button
                variant="inline-link"
                onClick={() => onDelete(item.id)}
              >
                Delete
              </Button>
            </SpaceBetween>
          ),
        },
      ]}
      items={sortedHistory}
      loading={loading}
      loadingText="Loading address history"
      empty={
        <Box textAlign="center" color="inherit">
          <b>No address history</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            No address history records found for this participant.
          </Box>
        </Box>
      }
    />
  );
};
