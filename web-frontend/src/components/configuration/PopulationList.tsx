import { useState } from 'react';
import {
  Table,
  Box,
  SpaceBetween,
  Button,
  Header,
  Link,
} from '@cloudscape-design/components';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PopulationService } from '../../services/api/population.service';
import type { Population } from '../../types';
import { PopulationForm } from './PopulationForm';
import { ResponsiveButton } from '../common/ResponsiveButton';
import { useAuth } from '../../hooks/useAuth';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { MergeInitiationModal } from '../merge/MergeInitiationModal';

export function PopulationList() {
  const [selectedPopulation, setSelectedPopulation] = useState<Population | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Population | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourcePopulation, setMergeSourcePopulation] = useState<Population | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const isAdmin = user?.role === 'ADMINISTRATOR';

  const { data: populations = [], isLoading } = useQuery({
    queryKey: ['populations'],
    queryFn: PopulationService.getPopulations,
  });

  const deleteMutation = useMutation({
    mutationFn: PopulationService.deletePopulation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['populations'] });
    },
  });

  const handleCreate = () => {
    setSelectedPopulation(null);
    setIsCreating(true);
    setIsFormVisible(true);
  };

  const handleEdit = (population: Population) => {
    setSelectedPopulation(population);
    setIsCreating(false);
    setIsFormVisible(true);
  };

  const handleDelete = (population: Population) => {
    setConfirmDelete(population);
  };

  const handleMerge = (population: Population) => {
    setMergeSourcePopulation(population);
    setShowMergeModal(true);
  };

  const handleConfirmDelete = async () => {
    if (confirmDelete) {
      try {
        await deleteMutation.mutateAsync(confirmDelete.id);
        setConfirmDelete(null);
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Failed to remove population';
        alert(errorMessage);
        setConfirmDelete(null);
      }
    }
  };

  const handleFormClose = () => {
    setIsFormVisible(false);
    setSelectedPopulation(null);
  };

  return (
    <SpaceBetween size="l">
      <Table
        wrapLines={false}
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            cell: (item) => (
              <Link onFollow={() => handleEdit(item)}>{item.name}</Link>
            ),
            sortingField: 'name',
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (item) => (
              isAdmin ? (
                <Box>
                  <Button 
                    variant="inline-link" 
                    iconName="edit"
                    onClick={() => handleEdit(item)}
                    ariaLabel={`Edit ${item.name}`}
                  />
                  <Button 
                    variant="inline-link" 
                    iconName="shrink"
                    onClick={() => handleMerge(item)}
                    ariaLabel={`Merge ${item.name}`}
                  />
                  <Button
                    variant="inline-link" 
                    iconName="remove"
                    onClick={() => handleDelete(item)}
                    ariaLabel={`Remove ${item.name}`}
                  />
                </Box>
              ) : null
            ),
          },
        ]}
        items={populations}
        loading={isLoading}
        loadingText="Loading populations"
        sortingDisabled={false}
        empty={
          <Box textAlign="center" color="inherit">
            <b>No populations</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              No populations to display.
            </Box>
          </Box>
        }
        header={
          <Header
            actions={
              isAdmin && (
                <ResponsiveButton 
                  onClick={handleCreate}
                  mobileIcon="add-plus"
                  mobileAriaLabel="Create new population"
                >
                  Create Population
                </ResponsiveButton>
              )
            }
          >
            Populations
          </Header>
        }
      />

      {isFormVisible && (
        <PopulationForm
          population={selectedPopulation}
          isCreating={isCreating}
          onClose={handleFormClose}
        />
      )}

      <ConfirmationDialog
        visible={confirmDelete !== null}
        title="Remove Population"
        message={`Are you sure you want to remove "${confirmDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Merge Initiation Modal */}
      {mergeSourcePopulation && (
        <MergeInitiationModal
          entityType="population"
          currentEntityId={mergeSourcePopulation.id}
          currentEntityName={mergeSourcePopulation.name}
          isOpen={showMergeModal}
          onDismiss={() => {
            setShowMergeModal(false);
            setMergeSourcePopulation(null);
          }}
          onConfirm={() => {
            setShowMergeModal(false);
            setMergeSourcePopulation(null);
            queryClient.invalidateQueries({ queryKey: ['populations'] });
          }}
        />
      )}
    </SpaceBetween>
  );
}
