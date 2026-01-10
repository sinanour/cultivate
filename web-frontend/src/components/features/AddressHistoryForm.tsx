import React, { useState, useEffect } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  FormField,
  DatePicker,
  Alert,
} from '@cloudscape-design/components';
import type { ParticipantAddressHistory } from '../../types';
import { AsyncEntitySelect } from '../common/AsyncEntitySelect';
import { EntitySelectorWithActions } from '../common/EntitySelectorWithActions';
import { VenueService } from '../../services/api/venue.service';
import { useAuth } from '../../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

interface AddressHistoryFormProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (data: { venueId: string; effectiveFrom: string | null }) => Promise<void>;
  existingRecord?: ParticipantAddressHistory;
  existingDates?: (string | null)[]; // Array of existing effective dates to check for duplicates (including null)
  loading?: boolean;
}

export const AddressHistoryForm: React.FC<AddressHistoryFormProps> = ({
  visible,
  onDismiss,
  onSubmit,
  existingRecord,
  existingDates = [],
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
      if (existingRecord) {
        setVenueId(existingRecord.venueId);
        setEffectiveFrom(existingRecord.effectiveFrom ? existingRecord.effectiveFrom.split('T')[0] : ''); // Extract date part or empty for null
      } else {
        setVenueId('');
        setEffectiveFrom('');
      }
      setErrors({});
    }
  }, [visible, existingRecord]);

  const validate = (): boolean => {
    const newErrors: { venue?: string; effectiveFrom?: string; duplicate?: string } = {};

    if (!venueId) {
      newErrors.venue = 'Venue is required';
    }

    // effectiveFrom is now optional - only validate for duplicates if provided
    if (effectiveFrom) {
      // Check for duplicate dates (excluding current record if editing)
      const isDuplicate = existingDates.some(date => {
        if (date === null) return false; // Skip null dates in this check
        const existingDate = date.split('T')[0];
        const isCurrentRecord = existingRecord && date === existingRecord.effectiveFrom;
        return existingDate === effectiveFrom && !isCurrentRecord;
      });

      if (isDuplicate) {
        newErrors.duplicate = 'An address history record with this effective date already exists';
      }
    } else {
      // Check if a null effectiveFrom already exists (excluding current record if editing)
      const hasNullDate = existingDates.some(date => {
        const isCurrentRecord = existingRecord && date === existingRecord.effectiveFrom;
        return date === null && !isCurrentRecord;
      });

      if (hasNullDate) {
        newErrors.duplicate = 'Only one address history record can have no effective date (initial address) per participant';
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
      console.error('Failed to save address history:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={existingRecord ? 'Edit Address History' : 'Add Address History'}
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
              {existingRecord ? 'Update' : 'Add'}
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
          description="Select the venue for this address"
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
                return await VenueService.getVenues(
                  params.page,
                  params.limit,
                  params.geographicAreaId,
                  params.search
                );
              }}
              formatOption={(v) => ({
                value: v.id,
                label: v.name,
                description: v.address,
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
          description="The date when this address became effective (leave empty for initial address)"
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
