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
import { VenueService } from '../../services/api/venue.service';

interface AddressHistoryFormProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (data: { venueId: string; effectiveFrom: string }) => Promise<void>;
  existingRecord?: ParticipantAddressHistory;
  existingDates?: string[]; // Array of existing effective dates to check for duplicates
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
  const [venueId, setVenueId] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>('');
  const [errors, setErrors] = useState<{ venue?: string; effectiveFrom?: string; duplicate?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      if (existingRecord) {
        setVenueId(existingRecord.venueId);
        setEffectiveFrom(existingRecord.effectiveFrom.split('T')[0]); // Extract date part
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

    if (!effectiveFrom) {
      newErrors.effectiveFrom = 'Effective start date is required';
    } else {
      // Check for duplicate dates (excluding current record if editing)
      const isDuplicate = existingDates.some(date => {
        const existingDate = date.split('T')[0];
        const isCurrentRecord = existingRecord && date === existingRecord.effectiveFrom;
        return existingDate === effectiveFrom && !isCurrentRecord;
      });

      if (isDuplicate) {
        newErrors.duplicate = 'An address history record with this effective date already exists';
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
      // Convert date to ISO format with time
      const isoDate = new Date(effectiveFrom).toISOString();
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
          <AsyncEntitySelect
            value={venueId}
            onChange={(value) => {
              setVenueId(value);
              setErrors({ ...errors, venue: undefined, duplicate: undefined });
            }}
            entityType="venue"
            fetchFunction={async (params) => {
              const data = await VenueService.getVenues(
                params.page,
                params.limit,
                params.geographicAreaId,
                params.search
              );
              return { data };
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
        </FormField>

        <FormField
          label="Effective Start Date"
          errorText={errors.effectiveFrom}
          description="The date when this address became effective"
        >
          <DatePicker
            value={effectiveFrom}
            onChange={({ detail }) => {
              setEffectiveFrom(detail.value);
              setErrors({ ...errors, effectiveFrom: undefined, duplicate: undefined });
            }}
            placeholder="YYYY-MM-DD"
            disabled={loading}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
};
