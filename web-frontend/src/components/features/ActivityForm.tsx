import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import DatePicker from '@cloudscape-design/components/date-picker';
import Checkbox from '@cloudscape-design/components/checkbox';
import Multiselect from '@cloudscape-design/components/multiselect';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import type { Activity } from '../../types';
import { ActivityService } from '../../services/api/activity.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { VenueService } from '../../services/api/venue.service';

interface ActivityFormProps {
  activity: Activity | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ActivityForm({ activity, onSuccess, onCancel }: ActivityFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(activity?.name || '');
  const [activityTypeId, setActivityTypeId] = useState(activity?.activityTypeId || '');
  const [startDate, setStartDate] = useState(activity?.startDate?.split('T')[0] || '');
  const [endDate, setEndDate] = useState(activity?.endDate?.split('T')[0] || '');
  const [isOngoing, setIsOngoing] = useState(activity?.isOngoing || false);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  
  const [nameError, setNameError] = useState('');
  const [activityTypeError, setActivityTypeError] = useState('');
  const [startDateError, setStartDateError] = useState('');
  const [endDateError, setEndDateError] = useState('');
  const [error, setError] = useState('');

  const { data: activityTypes = [] } = useQuery({
    queryKey: ['activityTypes'],
    queryFn: () => ActivityTypeService.getActivityTypes(),
  });

  const { data: venues = [] } = useQuery({
    queryKey: ['venues'],
    queryFn: () => VenueService.getVenues(),
  });

  const activityTypeOptions = activityTypes.map((t) => ({
    label: t.name,
    value: t.id,
  }));

  const venueOptions = venues.map((v) => ({
    label: v.name,
    value: v.id,
  }));

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      activityTypeId: string;
      startDate: string;
      endDate?: string;
      isOngoing: boolean;
      venueIds?: string[];
    }) => ActivityService.createActivity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create activity');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string;
      name: string;
      activityTypeId: string;
      startDate: string;
      endDate?: string;
      isOngoing: boolean;
      venueIds?: string[];
    }) =>
      ActivityService.updateActivity(data.id, {
        name: data.name,
        activityTypeId: data.activityTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        isOngoing: data.isOngoing,
        venueIds: data.venueIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update activity');
    },
  });

  const validateName = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setNameError('Name is required');
      return false;
    }
    setNameError('');
    return true;
  };

  const validateActivityType = (value: string): boolean => {
    if (!value) {
      setActivityTypeError('Activity type is required');
      return false;
    }
    setActivityTypeError('');
    return true;
  };

  const validateStartDate = (value: string): boolean => {
    if (!value) {
      setStartDateError('Start date is required');
      return false;
    }
    setStartDateError('');
    return true;
  };

  const validateEndDate = (value: string, ongoing: boolean): boolean => {
    if (!ongoing && !value) {
      setEndDateError('End date is required for finite activities');
      return false;
    }
    setEndDateError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const isNameValid = validateName(name);
    const isActivityTypeValid = validateActivityType(activityTypeId);
    const isStartDateValid = validateStartDate(startDate);
    const isEndDateValid = validateEndDate(endDate, isOngoing);

    if (!isNameValid || !isActivityTypeValid || !isStartDateValid || !isEndDateValid) {
      return;
    }

    const data = {
      name: name.trim(),
      activityTypeId,
      startDate: new Date(startDate).toISOString(),
      endDate: !isOngoing && endDate ? new Date(endDate).toISOString() : undefined,
      isOngoing,
      venueIds: selectedVenues.length > 0 ? selectedVenues : undefined,
    };

    if (activity) {
      updateMutation.mutate({ id: activity.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" loading={isSubmitting} disabled={isSubmitting} formAction="submit">
              {activity ? 'Update' : 'Create'}
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          {error && (
            <Alert type="error" dismissible onDismiss={() => setError('')}>
              {error}
            </Alert>
          )}
          <FormField label="Name" errorText={nameError} constraintText="Required">
            <Input
              value={name}
              onChange={({ detail }) => {
                setName(detail.value);
                if (nameError) validateName(detail.value);
              }}
              onBlur={() => validateName(name)}
              placeholder="Enter activity name"
              disabled={isSubmitting}
            />
          </FormField>
          <FormField label="Activity Type" errorText={activityTypeError} constraintText="Required">
            <Select
              selectedOption={activityTypeOptions.find((o) => o.value === activityTypeId) || null}
              onChange={({ detail }) => {
                setActivityTypeId(detail.selectedOption.value || '');
                if (activityTypeError) validateActivityType(detail.selectedOption.value || '');
              }}
              options={activityTypeOptions}
              placeholder="Select an activity type"
              disabled={isSubmitting}
              empty="No activity types available"
            />
          </FormField>
          <FormField label="Start Date" errorText={startDateError} constraintText="Required">
            <DatePicker
              value={startDate}
              onChange={({ detail }) => {
                setStartDate(detail.value);
                if (startDateError) validateStartDate(detail.value);
              }}
              placeholder="YYYY-MM-DD"
              disabled={isSubmitting}
            />
          </FormField>
          <FormField>
            <Checkbox
              checked={isOngoing}
              onChange={({ detail }) => {
                setIsOngoing(detail.checked);
                if (detail.checked) {
                  setEndDate('');
                  setEndDateError('');
                } else {
                  validateEndDate(endDate, detail.checked);
                }
              }}
              disabled={isSubmitting}
            >
              This is an ongoing activity (no end date)
            </Checkbox>
          </FormField>
          {!isOngoing && (
            <FormField label="End Date" errorText={endDateError} constraintText="Required for finite activities">
              <DatePicker
                value={endDate}
                onChange={({ detail }) => {
                  setEndDate(detail.value);
                  if (endDateError) validateEndDate(detail.value, isOngoing);
                }}
                placeholder="YYYY-MM-DD"
                disabled={isSubmitting}
              />
            </FormField>
          )}
          <FormField label="Venues" constraintText="Optional - select one or more venues">
            <Multiselect
              selectedOptions={venueOptions.filter((o) => selectedVenues.includes(o.value))}
              onChange={({ detail }) => {
                setSelectedVenues(detail.selectedOptions.map((o) => o.value || ''));
              }}
              options={venueOptions}
              placeholder="Select venues"
              disabled={isSubmitting}
              empty="No venues available"
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </form>
  );
}
