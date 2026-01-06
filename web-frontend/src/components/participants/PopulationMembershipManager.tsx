import { useState, useEffect, useRef } from 'react';
import {
  FormField,
  Multiselect,
  type MultiselectProps,
} from '@cloudscape-design/components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PopulationService, ParticipantPopulationService } from '../../services/api/population.service';
import { EntitySelectorWithActions } from '../common/EntitySelectorWithActions';
import { useAuth } from '../../hooks/useAuth';

interface PopulationMembershipManagerProps {
  participantId: string | null; // null when creating new participant
  value: string[]; // Array of population IDs
  onChange: (populationIds: string[]) => void;
  onInitialLoad?: (populationIds: string[]) => void; // Callback when initial populations are loaded
  disabled?: boolean;
}

export function PopulationMembershipManager({
  participantId,
  value,
  onChange,
  onInitialLoad,
  disabled = false,
}: PopulationMembershipManagerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOptions, setSelectedOptions] = useState<MultiselectProps.Options>([]);
  const hasInitialized = useRef(false);
  const [isRefreshingPopulations, setIsRefreshingPopulations] = useState(false);

  const canAddPopulation = user?.role === 'ADMINISTRATOR';

  const handleRefreshPopulations = async () => {
    setIsRefreshingPopulations(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['populations'] });
      await queryClient.refetchQueries({ queryKey: ['populations'] });
    } finally {
      setIsRefreshingPopulations(false);
    }
  };

  // Fetch all available populations
  const { data: allPopulations = [] } = useQuery({
    queryKey: ['populations'],
    queryFn: PopulationService.getPopulations,
  });

  // Fetch participant's current populations (only if editing existing participant)
  const { data: participantPopulations = [] } = useQuery({
    queryKey: ['participantPopulations', participantId],
    queryFn: () => participantId ? ParticipantPopulationService.getParticipantPopulations(participantId) : Promise.resolve([]),
    enabled: !!participantId,
  });

  // Convert all populations to options
  const allOptions: MultiselectProps.Options = allPopulations.map((pop) => ({
    label: pop.name,
    value: pop.id,
  }));

  // Update selected options when value prop changes or populations load
  useEffect(() => {
    const selected = value
      .map((id) => {
        const pop = allPopulations.find((p) => p.id === id);
        return pop ? { label: pop.name, value: pop.id } : null;
      })
      .filter(Boolean) as MultiselectProps.Options;
    
    setSelectedOptions(selected);
  }, [value, allPopulations]);

  // Initialize value from fetched participant populations (only once when editing)
  useEffect(() => {
    if (participantId && participantPopulations.length > 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      const initialIds = participantPopulations.map(pp => pp.populationId);
      // Call onInitialLoad FIRST to update parent's initial state
      if (onInitialLoad) {
        onInitialLoad(initialIds);
      }
      // Then update current value
      onChange(initialIds);
    }
  }, [participantId, participantPopulations, onChange, onInitialLoad]);

  // Reset initialization flag when participant changes
  useEffect(() => {
    hasInitialized.current = false;
  }, [participantId]);

  const handleChange = ({ detail }: { detail: MultiselectProps.MultiselectChangeDetail }) => {
    const newSelection = detail.selectedOptions;
    setSelectedOptions(newSelection);
    
    // Extract population IDs and notify parent
    const populationIds = newSelection.map(opt => opt.value!);
    onChange(populationIds);
  };

  return (
    <FormField
      label="Populations"
      description="Select one or more populations for this participant"
    >
      <EntitySelectorWithActions
        onRefresh={handleRefreshPopulations}
        addEntityUrl="/configuration"
        canAdd={canAddPopulation}
        isRefreshing={isRefreshingPopulations}
        entityTypeName="population"
      >
        <Multiselect
          selectedOptions={selectedOptions}
          onChange={handleChange}
          options={allOptions}
          placeholder="Select populations"
          disabled={disabled}
          filteringType="auto"
          tokenLimit={3}
        />
      </EntitySelectorWithActions>
    </FormField>
  );
}


