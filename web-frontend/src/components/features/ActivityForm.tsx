import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import DatePicker from '@cloudscape-design/components/date-picker';
import Checkbox from '@cloudscape-design/components/checkbox';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import type { Activity, ActivityVenueHistory } from '../../types';
import { ActivityService } from '../../services/api/activity.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { VenueService } from '../../services/api/venue.service';
import { VersionConflictModal } from '../common/VersionConflictModal';
import { useVersionConflict } from '../../hooks/useVersionConflict';
import { getEntityVersion } from '../../utils/version-conflict.utils';

interface ActivityFormProps {
  activity: Activity | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const STATUS_OPTIONS = [
  { label: 'Planned', value: 'PLANNED' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export function ActivityForm({ activity, onSuccess, onCancel }: ActivityFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [activityTypeId, setActivityTypeId] = useState('');
  const [status, setStatus] = useState<Activity['status']>('PLANNED');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isOngoing, setIsOngoing] = useState(false);
  
  const [nameError, setNameError] = useState('');
  const [activityTypeError, setActivityTypeError] = useState('');
  const [startDateError, setStartDateError] = useState('');
  const [endDateError, setEndDateError] = useState('');
  const [error, setError] = useState('');

  // Venue history state
  const [venueHistory, setVenueHistory] = useState<ActivityVenueHistory[]>([]);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [newVenueId, setNewVenueId] = useState('');
  const [newVenueEffectiveFrom, setNewVenueEffectiveFrom] = useState('');
  const [venueFormErrors, setVenueFormErrors] = useState<{ venue?: string; effectiveFrom?: string; duplicate?: string }>({});

  // Fetch venue history when editing existing activity
  const { data: fetchedVenueHistory = [] } = useQuery({
    queryKey: ['activityVenues', activity?.id],
    queryFn: () => activity ? ActivityService.getActivityVenues(activity.id) : Promise.resolve([]),
    enabled: !!activity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity, // Don't automatically refetch
  });

  // Update form state when activity prop changes
  useEffect(() => {
    if (activity) {
      setName(activity.name || '');
      setActivityTypeId(activity.activityTypeId || '');
      setStatus(activity.status || 'PLANNED');
      setStartDate(activity.startDate?.split('T')[0] || '');
      setEndDate(activity.endDate?.split('T')[0] || '');
      setIsOngoing(activity.isOngoing || false);
    } else {
      // Reset to defaults for create mode
      setName('');
      setActivityTypeId('');
      setStatus('PLANNED');
      setStartDate('');
      setEndDate('');
      setIsOngoing(false);
      setVenueHistory([]);
    }
    // Clear errors when switching modes
    setNameError('');
    setActivityTypeError('');
    setStartDateError('');
    setEndDateError('');
    setError('');
    setShowVenueForm(false);
  }, [activity]);

  // Update venue history when fetched data changes (separate effect to avoid resetting form fields)
  useEffect(() => {
    if (activity && fetchedVenueHistory) {
      setVenueHistory(fetchedVenueHistory);
    }
  }, [activity, fetchedVenueHistory]);

  const versionConflict = useVersionConflict({
    queryKey: ['activities'],
    onDiscard: onCancel,
  });

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
    label: `${v.name} - ${v.address}`,
    value: v.id,
  }));

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      activityTypeId: string;
      status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
      startDate: string;
      endDate?: string;
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
      name?: string;
      activityTypeId?: string;
      status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
      startDate?: string;
      endDate?: string;
      version?: number;
    }) => ActivityService.updateActivity(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      onSuccess();
    },
    onError: (err: Error) => {
      if (!versionConflict.handleError(err)) {
        setError(err.message || 'Failed to update activity');
      }
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

  // Venue history management functions
  const handleAddVenue = (e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setNewVenueId('');
    setNewVenueEffectiveFrom('');
    setVenueFormErrors({});
    setShowVenueForm(true);
  };

  const handleDeleteVenue = async (venueId: string, e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    
    if (!activity) {
      // Remove from pending list for new activity
      setVenueHistory(prev => prev.filter(v => v.venueId !== venueId));
      return;
    }
    
    try {
      await ActivityService.deleteActivityVenue(activity.id, venueId);
      setVenueHistory(prev => prev.filter(v => v.venueId !== venueId));
    } catch (err) {
      setError('Failed to remove venue association');
    }
  };

  const validateVenueForm = (): boolean => {
    const newErrors: { venue?: string; effectiveFrom?: string; duplicate?: string } = {};

    if (!newVenueId) {
      newErrors.venue = 'Venue is required';
    }

    if (!newVenueEffectiveFrom) {
      newErrors.effectiveFrom = 'Effective start date is required';
    } else {
      // Check for duplicate dates
      const isDuplicate = venueHistory.some(vh => {
        const existingDate = vh.effectiveFrom.split('T')[0];
        return existingDate === newVenueEffectiveFrom;
      });

      if (isDuplicate) {
        newErrors.duplicate = 'A venue association with this effective date already exists';
      }
    }

    setVenueFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveVenue = async (e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    
    if (!validateVenueForm()) {
      return;
    }

    const isoDate = new Date(newVenueEffectiveFrom).toISOString();

    if (activity) {
      // Add venue to existing activity
      try {
        await ActivityService.addActivityVenue(activity.id, newVenueId, isoDate);
        const updated = await ActivityService.getActivityVenues(activity.id);
        setVenueHistory(updated);
        setShowVenueForm(false);
      } catch (err) {
        setError('Failed to add venue association');
      }
    } else {
      // Add to pending list for new activity (will be created after activity is created)
      const tempVenue: ActivityVenueHistory = {
        id: `temp-${Date.now()}`,
        activityId: '',
        venueId: newVenueId,
        effectiveFrom: isoDate,
        venue: venues.find(v => v.id === newVenueId),
      };
      setVenueHistory(prev => [...prev, tempVenue]);
      setShowVenueForm(false);
    }
  };

  const handleCancelVenueForm = (e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setShowVenueForm(false);
    setVenueFormErrors({});
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
      status: status as 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
      startDate: new Date(startDate).toISOString(),
      endDate: !isOngoing && endDate ? new Date(endDate).toISOString() : undefined,
    };

    if (activity) {
      updateMutation.mutate({
        id: activity.id,
        ...data,
        version: getEntityVersion(activity),
      });
    } else {
      // For new activities, create activity first, then create venue associations
      try {
        const created = await ActivityService.createActivity(data);
        
        // Create venue associations if any were added
        const pendingVenues = venueHistory.filter(v => v.id.startsWith('temp-'));
        for (const venue of pendingVenues) {
          await ActivityService.addActivityVenue(created.id, venue.venueId, venue.effectiveFrom);
        }
        
        queryClient.invalidateQueries({ queryKey: ['activities'] });
        queryClient.invalidateQueries({ queryKey: ['activityVenues'] });
        onSuccess();
      } catch (err: any) {
        setError(err.message || 'Failed to create activity');
      }
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Sort venue history by effectiveFrom descending (most recent first)
  const sortedVenueHistory = [...venueHistory].sort((a, b) => 
    new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
  );

  return (
    <>
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
            <FormField label="Status" constraintText="Required">
              <Select
                selectedOption={STATUS_OPTIONS.find((o) => o.value === status) || STATUS_OPTIONS[0]}
                onChange={({ detail }) => setStatus(detail.selectedOption.value as Activity['status'])}
                options={STATUS_OPTIONS}
                disabled={isSubmitting}
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

            {/* Embedded Venue History Management */}
            <Container
              header={
                <Header
                  variant="h3"
                  actions={
                    <Button
                      onClick={(e) => handleAddVenue(e)}
                      disabled={isSubmitting}
                      iconName="add-plus"
                    >
                      Add Venue
                    </Button>
                  }
                >
                  Venue Associations
                </Header>
              }
            >
              <SpaceBetween size="m">
                {showVenueForm && (
                  <Container>
                    <SpaceBetween size="m">
                      {venueFormErrors.duplicate && (
                        <Alert type="error">{venueFormErrors.duplicate}</Alert>
                      )}
                      <FormField
                        label="Venue"
                        errorText={venueFormErrors.venue}
                        description="Select the venue for this activity"
                      >
                        <Select
                          selectedOption={venueOptions.find(o => o.value === newVenueId) || null}
                          onChange={({ detail }) => {
                            setNewVenueId(detail.selectedOption.value || '');
                            setVenueFormErrors({ ...venueFormErrors, venue: undefined, duplicate: undefined });
                          }}
                          options={venueOptions}
                          placeholder="Choose a venue"
                          filteringType="auto"
                        />
                      </FormField>
                      <FormField
                        label="Effective Start Date"
                        errorText={venueFormErrors.effectiveFrom}
                        description="The date when this venue association became effective"
                      >
                        <DatePicker
                          value={newVenueEffectiveFrom}
                          onChange={({ detail }) => {
                            setNewVenueEffectiveFrom(detail.value);
                            setVenueFormErrors({ ...venueFormErrors, effectiveFrom: undefined, duplicate: undefined });
                          }}
                          placeholder="YYYY-MM-DD"
                        />
                      </FormField>
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button onClick={(e) => handleCancelVenueForm(e)}>Cancel</Button>
                        <Button variant="primary" onClick={(e) => handleSaveVenue(e)}>
                          Add
                        </Button>
                      </SpaceBetween>
                    </SpaceBetween>
                  </Container>
                )}

                {sortedVenueHistory.length > 0 ? (
                  <Table<ActivityVenueHistory>
                    columnDefinitions={[
                      {
                        id: 'venue',
                        header: 'Venue',
                        cell: (item) => item.venue?.name || 'Unknown',
                      },
                      {
                        id: 'effectiveFrom',
                        header: 'Effective From',
                        cell: (item) => new Date(item.effectiveFrom).toLocaleDateString(),
                      },
                      {
                        id: 'actions',
                        header: 'Actions',
                        cell: (item) => (
                          <Button
                            variant="inline-icon"
                            iconName="remove"
                            onClick={(e) => handleDeleteVenue(item.venueId, e)}
                            disabled={isSubmitting}
                          />
                        ),
                      },
                    ]}
                    items={sortedVenueHistory}
                    variant="embedded"
                    empty={
                      <Box textAlign="center" color="inherit">
                        <b>No venue associations</b>
                        <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                          Add venue associations to track where this activity takes place.
                        </Box>
                      </Box>
                    }
                  />
                ) : (
                  <Box textAlign="center" color="inherit">
                    <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                      No venue associations yet. Click "Add Venue" to add one.
                    </Box>
                  </Box>
                )}
              </SpaceBetween>
            </Container>
          </SpaceBetween>
        </Form>
      </form>

      <VersionConflictModal
        visible={versionConflict.showConflictModal}
        conflictInfo={versionConflict.conflictInfo}
        onRetryWithLatest={versionConflict.handleRetryWithLatest}
        onDiscardChanges={versionConflict.handleDiscardChanges}
      />
    </>
  );
}
