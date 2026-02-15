import React, { useState, useEffect } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  FormField,
  DatePicker,
  Alert,
  Button,
} from '@cloudscape-design/components';
import { useQueryClient } from '@tanstack/react-query';
import { AsyncEntitySelect } from '../common/AsyncEntitySelect';
import { EntitySelectorWithActions } from '../common/EntitySelectorWithActions';
import { VenueService } from '../../services/api/venue.service';
import { formatDate } from '../../utils/date.utils';
import { useAuth } from '../../hooks/useAuth';

interface ActivityVenueHistoryFormProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (data: { venueId: string; effectiveFrom: string | null }) => Promise<void>;
  existingDates?: (string | null)[]; // Array of existing effective dates to check for duplicates (including null)
  activityStartDate?: string; // Activity start date for display context
  loading?: boolean;
}

export const ActivityVenueHistoryForm: React.FC<ActivityVenueHistoryFormProps> = ({
  visible,
  onDismiss,
  onSubmit,
  existingDates = [],
  activityStartDate,
  loading = false,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [venueId, setVenueId] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>('');
  const [errors, setErrors] = useState<{ venue?: string; effectiveFrom?: string; duplicate?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [isRefreshingVenues, setIsRefreshingVenues] = useState(false);

  const canAddVenue = user?.role === 'ADMINISTRATOR' || user?.role === 'EDITOR';

  const handleRefreshVenues = async () => {
    setIsRefreshingVenues(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['venues'] });
      await queryClient.refetchQueries({ queryKey: ['venues'] });
    } finally {
      setIsRefreshingVenues(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setVenueId('');
      setEffectiveFrom('');
      setErrors({});
    }
  }, [visible]);

  const validate = (): boolean => {
    const newErrors: { venue?: string; effectiveFrom?: string; duplicate?: string } = {};

    if (!venueId) {
      newErrors.venue = 'Venue is required';
    }

    // effectiveFrom is now optional - only validate for duplicates if provided
    if (effectiveFrom) {
      // Check for duplicate dates
      const isDuplicate = existingDates.some(date => {
        if (date === null) return false; // Skip null dates in this check
        const existingDate = date.split('T')[0];
        return existingDate === effectiveFrom;
      });

      if (isDuplicate) {
        newErrors.duplicate = 'A venue association with this effective date already exists';
      }
    } else {
      // Check if a null effectiveFrom already exists
      const hasNullDate = existingDates.some(date => date === null);

      if (hasNullDate) {
        newErrors.duplicate = 'Only one venue association can have no effective date (since activity start) per activity';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      // Convert date to ISO format with time, or null if empty
      const isoDate = effectiveFrom ? new Date(effectiveFrom).toISOString() : null;
      await onSubmit({ venueId, effectiveFrom: isoDate });
      onDismiss();
    } catch (error) {
      console.error('Failed to add venue association:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header="Add Venue Association"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || loading}
              loading={submitting}
            >
              Add
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        {errors.duplicate && (
          <Alert type="error" header="Duplicate Record">
            {errors.duplicate}
          </Alert>
        )}

        <FormField
          label="Venue"
          errorText={errors.venue}
          description="Select the venue for this activity"
        >
          <EntitySelectorWithActions
            onRefresh={handleRefreshVenues}
            addEntityUrl="/venues/new"
            canAdd={canAddVenue}
            isRefreshing={isRefreshingVenues}
            entityTypeName="venue"
          >
            <AsyncEntitySelect
              value={venueId}
              onChange={(value) => {
                setVenueId(value);
                setErrors({ ...errors, venue: undefined, duplicate: undefined });
              }}
              entityType="venue"
              fetchFunction={async (params) => {
                return await VenueService.getVenuesFlexible({
                  page: params.page,
                  limit: params.limit,
                  geographicAreaId: params.geographicAreaId,
                  filter: params.filter,
                  fields: params.fields
                });
              }}
              fetchByIdFunction={async (id: string) => {
                return await VenueService.getVenueById(id);
              }}
              formatOption={(v) => ({
                value: v.id,
                label: v.name,
                description: v.address || undefined,
              })}
              placeholder="Search for a venue"
              disabled={loading}
              invalid={!!errors.venue}
              ariaLabel="Select venue"
            />
          </EntitySelectorWithActions>
        </FormField>

        <FormField
          label="Effective Start Date"
          errorText={errors.effectiveFrom}
          description={
            activityStartDate
              ? `The date when this venue association became effective (leave empty to use activity start date: ${formatDate(activityStartDate)})`
              : "The date when this venue association became effective (leave empty for activity start date)"
          }
        >
          <DatePicker
            value={effectiveFrom}
            onChange={({ detail }) => {
              setEffectiveFrom(detail.value);
              setErrors({ ...errors, effectiveFrom: undefined, duplicate: undefined });
            }}
            placeholder="YYYY-MM-DD (optional)"
            disabled={loading}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
};
