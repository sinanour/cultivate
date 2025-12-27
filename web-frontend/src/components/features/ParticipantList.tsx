import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import TextFilter from '@cloudscape-design/components/text-filter';
import Pagination from '@cloudscape-design/components/pagination';
import Modal from '@cloudscape-design/components/modal';
import Alert from '@cloudscape-design/components/alert';
import type { Participant } from '../../types';
import { ParticipantService } from '../../services/api/participant.service';
import { ParticipantForm } from './ParticipantForm';
import { usePermissions } from '../../hooks/usePermissions';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';

const ITEMS_PER_PAGE = 10;

export function ParticipantList() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [filteringText, setFilteringText] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(1);

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ['participants', selectedGeographicAreaId],
    queryFn: () => ParticipantService.getParticipants(undefined, undefined, selectedGeographicAreaId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ParticipantService.deleteParticipant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      setDeleteError('');
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete participant.');
    },
  });

  // Client-side search
  const filteredParticipants = useMemo(() => {
    if (!filteringText) return participants;
    
    const searchTerm = filteringText.toLowerCase();
    return participants.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm) ||
        p.email.toLowerCase().includes(searchTerm)
    );
  }, [participants, filteringText]);

  // Pagination
  const paginatedParticipants = useMemo(() => {
    const startIndex = (currentPageIndex - 1) * ITEMS_PER_PAGE;
    return filteredParticipants.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredParticipants, currentPageIndex]);

  const handleEdit = (participant: Participant) => {
    setSelectedParticipant(participant);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedParticipant(null);
    setIsFormOpen(true);
  };

  const handleDelete = async (participant: Participant) => {
    if (window.confirm(`Are you sure you want to delete "${participant.name}"?`)) {
      deleteMutation.mutate(participant.id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedParticipant(null);
  };

  return (
    <SpaceBetween size="l">
      {deleteError && (
        <Alert
          type="error"
          dismissible
          onDismiss={() => setDeleteError('')}
        >
          {deleteError}
        </Alert>
      )}
      <Table
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            cell: (item) => (
              <Link href={`/participants/${item.id}`}>
                {item.name}
              </Link>
            ),
            sortingField: 'name',
          },
          {
            id: 'email',
            header: 'Email',
            cell: (item) => item.email,
            sortingField: 'email',
          },
          {
            id: 'phone',
            header: 'Phone',
            cell: (item) => item.phone || '-',
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                {canEdit() && (
                  <Button
                    variant="inline-link"
                    onClick={() => handleEdit(item)}
                  >
                    Edit
                  </Button>
                )}
                {canDelete() && (
                  <Button
                    variant="inline-link"
                    onClick={() => handleDelete(item)}
                  >
                    Delete
                  </Button>
                )}
              </SpaceBetween>
            ),
          },
        ]}
        items={paginatedParticipants}
        loading={isLoading}
        loadingText="Loading participants"
        sortingDisabled
        empty={
          <Box textAlign="center" color="inherit">
            <b>No participants</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              {filteringText ? 'No participants match your search.' : 'No participants to display.'}
            </Box>
            {canCreate() && !filteringText && (
              <Button onClick={handleCreate}>Create participant</Button>
            )}
          </Box>
        }
        filter={
          <TextFilter
            filteringText={filteringText}
            filteringPlaceholder="Search participants by name or email"
            filteringAriaLabel="Filter participants"
            onChange={({ detail }) => {
              setFilteringText(detail.filteringText);
              setCurrentPageIndex(1);
            }}
          />
        }
        header={
          <Header
            counter={`(${filteredParticipants.length})`}
            actions={
              canCreate() && (
                <Button variant="primary" onClick={handleCreate}>
                  Create participant
                </Button>
              )
            }
          >
            Participants
          </Header>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPageIndex}
            pagesCount={Math.ceil(filteredParticipants.length / ITEMS_PER_PAGE)}
            onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
          />
        }
      />
      <Modal
        visible={isFormOpen}
        onDismiss={handleFormClose}
        size="large"
        header={selectedParticipant ? 'Edit Participant' : 'Create Participant'}
      >
        {isFormOpen && (
          <ParticipantForm
            participant={selectedParticipant}
            onSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        )}
      </Modal>
    </SpaceBetween>
  );
}
