import React, { useState } from 'react';
import {
  Table,
  Box,
  Button,
  SpaceBetween,
  Header,
  Badge,
} from '@cloudscape-design/components';
import type { ParticipantAddressHistory } from '../../types';

interface AddressHistoryTableProps {
  addressHistory: ParticipantAddressHistory[];
  onEdit: (record: ParticipantAddressHistory) => void;
  onDelete: (recordId: string) => void;
  loading?: boolean;
}

export const AddressHistoryTable: React.FC<AddressHistoryTableProps> = ({
  addressHistory,
  onEdit,
  onDelete,
  loading = false,
}) => {
  const [selectedItems, setSelectedItems] = useState<ParticipantAddressHistory[]>([]);

  // Sort by effective start date in reverse chronological order (most recent first)
  const sortedHistory = [...addressHistory].sort((a, b) => {
    return new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime();
  });

  return (
    <Table
      columnDefinitions={[
        {
          id: 'venue',
          header: 'Venue',
          cell: (item: ParticipantAddressHistory) => (
            <Box>
              {item.venue?.name || 'Unknown Venue'}
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
          cell: (item: ParticipantAddressHistory) => item.venue?.address || 'N/A',
        },
        {
          id: 'effectiveFrom',
          header: 'Effective From',
          cell: (item: ParticipantAddressHistory) => {
            const date = new Date(item.effectiveFrom);
            return date.toLocaleDateString();
          },
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
      selectionType="single"
      selectedItems={selectedItems}
      onSelectionChange={({ detail }) =>
        setSelectedItems(detail.selectedItems)
      }
      empty={
        <Box textAlign="center" color="inherit">
          <b>No address history</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            No address history records found for this participant.
          </Box>
        </Box>
      }
      header={
        <Header
          variant="h3"
          description="Home address history in reverse chronological order"
        >
          Address History
        </Header>
      }
    />
  );
};
