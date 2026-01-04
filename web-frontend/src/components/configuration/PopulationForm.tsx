import { useState, useEffect } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  FormField,
  Input,
} from '@cloudscape-design/components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PopulationService } from '../../services/api/population.service';
import type { Population } from '../../types';

interface PopulationFormProps {
  population: Population | null;
  isCreating: boolean;
  onClose: () => void;
}

export function PopulationForm({ population, isCreating, onClose }: PopulationFormProps) {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (population) {
      setName(population.name);
    } else {
      setName('');
    }
    setNameError('');
  }, [population]);

  const createMutation = useMutation({
    mutationFn: PopulationService.createPopulation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['populations'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data, version }: { id: string; data: { name: string }; version?: number }) =>
      PopulationService.updatePopulation(id, data, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['populations'] });
      onClose();
    },
  });

  const handleSubmit = async () => {
    // Validate
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }

    try {
      if (isCreating) {
        await createMutation.mutateAsync({ name: name.trim() });
      } else if (population) {
        await updateMutation.mutateAsync({
          id: population.id,
          data: { name: name.trim() },
          version: population.version,
        });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Operation failed';
      alert(errorMessage);
    }
  };

  return (
    <Modal
      onDismiss={onClose}
      visible={true}
      header={isCreating ? 'Create Population' : 'Edit Population'}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {isCreating ? 'Create' : 'Update'}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <FormField
          label="Name"
          errorText={nameError}
        >
          <Input
            value={name}
            onChange={({ detail }) => {
              setName(detail.value);
              setNameError('');
            }}
            placeholder="Enter population name"
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}
