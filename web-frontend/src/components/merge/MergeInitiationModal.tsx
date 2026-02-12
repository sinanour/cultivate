import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  FormField,
  Alert,
} from '@cloudscape-design/components';
import { AsyncEntitySelect, type AsyncEntitySelectOption } from '../common/AsyncEntitySelect';
import { MergeConfirmationDialog } from './MergeConfirmationDialog';
import { MergeService } from '../../services/api/merge.service';
import { ParticipantService } from '../../services/api/participant.service';
import { ActivityService } from '../../services/api/activity.service';
import { VenueService } from '../../services/api/venue.service';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { PopulationService } from '../../services/api/population.service';

export type MergeableEntityType =
  | 'participant'
  | 'activity'
  | 'venue'
  | 'geographicArea'
  | 'activityType'
  | 'population';

export interface MergeInitiationModalProps {
  entityType: MergeableEntityType;
  currentEntityId: string;
  currentEntityName: string;
  isOpen: boolean;
  onDismiss: () => void;
  onConfirm: (sourceId: string, destinationId: string) => void;
}

/**
 * Dialog for selecting source and destination records for merge
 * Pre-populates source with current entity and allows swapping
 */
export function MergeInitiationModal({
  entityType,
  currentEntityId,
  isOpen,
  onDismiss,
  onConfirm,
}: MergeInitiationModalProps) {
  const navigate = useNavigate();
  const [sourceId, setSourceId] = useState(currentEntityId);
  const [destinationId, setDestinationId] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Determine if this is a simple entity (no reconciliation needed)
  const isSimpleEntity = entityType === 'activityType' || entityType === 'population';

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSourceId(currentEntityId);
      setDestinationId('');
      setValidationError(null);
      setShowConfirmation(false);
    }
  }, [isOpen, currentEntityId]);

  // Get fetch function and format function based on entity type
  const { fetchFunction, fetchByIdFunction, formatOption, asyncEntityType } = getEntityConfig(entityType);

  const handleSwap = () => {
    // Swap source and destination IDs
    const tempId = sourceId;
    setSourceId(destinationId);
    setDestinationId(tempId);
    setValidationError(null);
  };

  const handleSourceChange = (value: string) => {
    setSourceId(value);
    setValidationError(null);
  };

  const handleDestinationChange = (value: string) => {
    setDestinationId(value);
    setValidationError(null);
  };

  const handleConfirmClick = () => {
    // Validate both source and destination are selected
    if (!sourceId) {
      setValidationError('Please select a source record.');
      return;
    }

    if (!destinationId) {
      setValidationError('Please select a destination record.');
      return;
    }

    // Validate source and destination are different
    if (sourceId === destinationId) {
      setValidationError('Cannot merge a record with itself. Please select different records.');
      return;
    }

    // For simple entities, show confirmation dialog directly
    if (isSimpleEntity) {
      setShowConfirmation(true);
    } else {
      // For complex entities, navigate to reconciliation page
      navigate(`/merge/${entityType}/reconcile`, {
        state: { sourceId, destinationId },
      });
      onDismiss();
    }
  };

  const handleDirectMerge = async () => {
    if (!isSimpleEntity) return;

    try {
      // Execute merge for simple entities
      if (entityType === 'activityType') {
        await MergeService.mergeActivityTypes(destinationId, sourceId);
      } else if (entityType === 'population') {
        await MergeService.mergePopulations(destinationId, sourceId);
      }

  // Call parent onConfirm to handle success
      onConfirm(sourceId, destinationId);
      onDismiss();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to merge records');
      setShowConfirmation(false);
    }
  };

  const canSwap = sourceId && destinationId;

  return (
    <>
      <Modal
        visible={isOpen}
        onDismiss={onDismiss}
        header="Merge Records"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={onDismiss}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmClick}
                disabled={!sourceId || !destinationId || !!validationError}
              >
                Continue
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="l">
          <Box variant="p">
            Select the source and destination records to merge. The source record will be deleted
            after all related data is moved to the destination.
          </Box>

          {validationError && (
            <Alert type="error" header="Validation Error">
              {validationError}
            </Alert>
          )}

          <FormField label="Source Record" description="This record will be deleted after merge">
            <AsyncEntitySelect
              value={sourceId}
              onChange={handleSourceChange}
              entityType={asyncEntityType}
              fetchFunction={fetchFunction}
              fetchByIdFunction={fetchByIdFunction}
              formatOption={formatOption}
              ensureIncluded={sourceId}
              placeholder={`Select source ${entityType}`}
            />
          </FormField>

          <Box textAlign="center">
            <Button
              iconName="upload-download"
              onClick={handleSwap}
              disabled={!canSwap}
              ariaLabel="Swap source and destination"
            >
              Swap
            </Button>
          </Box>

          <FormField
            label="Destination Record"
            description="This record will be kept and updated"
          >
            <AsyncEntitySelect
              value={destinationId}
              onChange={handleDestinationChange}
              entityType={asyncEntityType}
              fetchFunction={fetchFunction}
              fetchByIdFunction={fetchByIdFunction}
              formatOption={formatOption}
              ensureIncluded={destinationId}
              placeholder={`Select destination ${entityType}`}
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Confirmation dialog for simple entities */}
      <MergeConfirmationDialog
        entityType={getEntityDisplayName(entityType)}
        sourceName="Source"
        destinationName="Destination"
        isOpen={showConfirmation}
        onConfirm={handleDirectMerge}
        onCancel={() => setShowConfirmation(false)}
      />
    </>
  );
}

/**
 * Get human-readable entity name
 */
function getEntityDisplayName(entityType: MergeableEntityType): string {
  switch (entityType) {
    case 'participant':
      return 'Participant';
    case 'activity':
      return 'Activity';
    case 'venue':
      return 'Venue';
    case 'geographicArea':
      return 'Geographic Area';
    case 'activityType':
      return 'Activity Type';
    case 'population':
      return 'Population';
  }
}

/**
 * Get entity-specific configuration for fetching and formatting
 */
function getEntityConfig(entityType: MergeableEntityType) {
  switch (entityType) {
    case 'participant':
      return {
        asyncEntityType: 'participant' as const,
        fetchFunction: ParticipantService.getParticipantsFlexible,
        fetchByIdFunction: ParticipantService.getParticipantById,
        formatOption: (p: any): AsyncEntitySelectOption => ({
          value: p.id,
          label: p.name,
          description: p.email || undefined,
        }),
      };
    case 'activity':
      return {
        asyncEntityType: 'activity' as const,
        fetchFunction: ActivityService.getActivitiesFlexible,
        fetchByIdFunction: ActivityService.getActivityById,
        formatOption: (a: any): AsyncEntitySelectOption => ({
          value: a.id,
          label: a.name,
          description: a.activityType?.name,
        }),
      };
    case 'venue':
      return {
        asyncEntityType: 'venue' as const,
        fetchFunction: VenueService.getVenuesFlexible,
        fetchByIdFunction: VenueService.getVenueById,
        formatOption: (v: any): AsyncEntitySelectOption => ({
          value: v.id,
          label: v.name,
          description: v.address,
        }),
      };
    case 'geographicArea':
      return {
        asyncEntityType: 'geographic-area' as const,
        fetchFunction: GeographicAreaService.getGeographicAreasFlexible,
        fetchByIdFunction: GeographicAreaService.getGeographicAreaById,
        formatOption: (g: any): AsyncEntitySelectOption => ({
          value: g.id,
          label: g.name,
          description: g.areaType,
        }),
      };
    case 'activityType':
      return {
        asyncEntityType: 'activity-type' as const,
        fetchFunction: async (_params: any) => {
          const types = await ActivityTypeService.getActivityTypes();
          return { data: types, pagination: { page: 1, limit: 50, total: types.length, totalPages: 1 } };
        },
        fetchByIdFunction: ActivityTypeService.getActivityTypeById,
        formatOption: (at: any): AsyncEntitySelectOption => ({
          value: at.id,
          label: at.name,
          description: at.activityCategory?.name,
        }),
      };
    case 'population':
      return {
        asyncEntityType: 'population' as const,
        fetchFunction: async (_params: any) => {
          const populations = await PopulationService.getPopulations();
          return { data: populations, pagination: { page: 1, limit: 50, total: populations.length, totalPages: 1 } };
        },
        fetchByIdFunction: PopulationService.getPopulationById,
        formatOption: (p: any): AsyncEntitySelectOption => ({
          value: p.id,
          label: p.name,
        }),
      };
  }
}
