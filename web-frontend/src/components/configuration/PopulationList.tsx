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

export function PopulationList() {
  const [selectedPopulation, setSelectedPopulation] = useState<Population | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
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

  const handleDelete = async (population: Population) => {
    if (window.confirm(`Are you sure you want to delete "${population.name}"?`)) {
      try {
        await deleteMutation.mutateAsync(population.id);
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Failed to delete population';
        alert(errorMessage);
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
                    iconName="remove"
                    onClick={() => handleDelete(item)}
                    ariaLabel={`Delete ${item.name}`}
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
    </SpaceBetween>
  );
}
