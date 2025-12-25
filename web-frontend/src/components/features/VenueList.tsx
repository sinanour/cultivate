import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import TextFilter from '@cloudscape-design/components/text-filter';
import Pagination from '@cloudscape-design/components/pagination';
import Modal from '@cloudscape-design/components/modal';
import Alert from '@cloudscape-design/components/alert';
import type { Venue } from '../../types';
import { VenueService } from '../../services/api/venue.service';
import { VenueForm } from './VenueForm';
import { usePermissions } from '../../hooks/usePermissions';

const ITEMS_PER_PAGE = 10;

export function VenueList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [filteringText, setFilteringText] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(1);

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: () => VenueService.getVenues(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => VenueService.deleteVenue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      setDeleteError('');
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete venue. It may be referenced by activities or participants.');
    },
  });

  // Client-side search
  const filteredVenues = useMemo(() => {
    if (!filteringText) return venues;
    
    const searchTerm = filteringText.toLowerCase();
    return venues.filter(
      (v) =>
        v.name.toLowerCase().includes(searchTerm) ||
        v.address.toLowerCase().includes(searchTerm)
    );
  }, [venues, filteringText]);

  // Pagination
  const paginatedVenues = useMemo(() => {
    const startIndex = (currentPageIndex - 1) * ITEMS_PER_PAGE;
    return filteredVenues.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredVenues, currentPageIndex]);

  const handleEdit = (venue: Venue) => {
    setSelectedVenue(venue);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedVenue(null);
    setIsFormOpen(true);
  };

  const handleDelete = async (venue: Venue) => {
    if (window.confirm(`Are you sure you want to delete "${venue.name}"?`)) {
      deleteMutation.mutate(venue.id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedVenue(null);
  };

  const handleViewDetails = (venue: Venue) => {
    navigate(`/venues/${venue.id}`);
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
            cell: (item) => item.name,
            sortingField: 'name',
          },
          {
            id: 'address',
            header: 'Address',
            cell: (item) => item.address,
            sortingField: 'address',
          },
          {
            id: 'geographicArea',
            header: 'Geographic Area',
            cell: (item) => item.geographicArea?.name || '-',
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="inline-link"
                  onClick={() => handleViewDetails(item)}
                >
                  View
                </Button>
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
        items={paginatedVenues}
        loading={isLoading}
        loadingText="Loading venues"
        sortingDisabled
        empty={
          <Box textAlign="center" color="inherit">
            <b>No venues</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              {filteringText ? 'No venues match your search.' : 'No venues to display.'}
            </Box>
            {canCreate() && !filteringText && (
              <Button onClick={handleCreate}>Create venue</Button>
            )}
          </Box>
        }
        filter={
          <TextFilter
            filteringText={filteringText}
            filteringPlaceholder="Search venues by name or address"
            filteringAriaLabel="Filter venues"
            onChange={({ detail }) => {
              setFilteringText(detail.filteringText);
              setCurrentPageIndex(1);
            }}
          />
        }
        header={
          <Header
            counter={`(${filteredVenues.length})`}
            actions={
              canCreate() && (
                <Button variant="primary" onClick={handleCreate}>
                  Create venue
                </Button>
              )
            }
          >
            Venues
          </Header>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPageIndex}
            pagesCount={Math.ceil(filteredVenues.length / ITEMS_PER_PAGE)}
            onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
          />
        }
      />
      <Modal
        visible={isFormOpen}
        onDismiss={handleFormClose}
        size="large"
        header={selectedVenue ? 'Edit Venue' : 'Create Venue'}
      >
        <VenueForm
          venue={selectedVenue}
          onSuccess={handleFormClose}
          onCancel={handleFormClose}
        />
      </Modal>
    </SpaceBetween>
  );
}
