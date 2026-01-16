import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from 'react-router-dom';
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
import Badge from '@cloudscape-design/components/badge';
import Textarea from '@cloudscape-design/components/textarea';
import Link from '@cloudscape-design/components/link';
import Modal from '@cloudscape-design/components/modal';
import type { Activity, ActivityVenueHistory, Assignment } from '../../types';
import { ActivityService } from '../../services/api/activity.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { VenueService } from '../../services/api/venue.service';
import { ParticipantService } from '../../services/api/participant.service';
import { ParticipantRoleService } from '../../services/api/participant-role.service';
import { AssignmentService } from '../../services/api/assignment.service';
import { VersionConflictModal } from '../common/VersionConflictModal';
import { useVersionConflict } from '../../hooks/useVersionConflict';
import { getEntityVersion } from '../../utils/version-conflict.utils';
import { formatDate } from '../../utils/date.utils';
import { AsyncEntitySelect } from '../common/AsyncEntitySelect';
import { EntitySelectorWithActions } from '../common/EntitySelectorWithActions';
import { useAuth } from '../../hooks/useAuth';

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
  const { user } = useAuth();
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
  const [isRefreshingVenues, setIsRefreshingVenues] = useState(false);

  // Participant assignment state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [newParticipantId, setNewParticipantId] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [assignmentFormErrors, setAssignmentFormErrors] = useState<{ participant?: string; role?: string; duplicate?: string }>({});
  const [isRefreshingParticipants, setIsRefreshingParticipants] = useState(false);
  const [isRefreshingRoles, setIsRefreshingRoles] = useState(false);

  const canAddVenue = user?.role === 'ADMINISTRATOR' || user?.role === 'EDITOR';
  const canAddParticipant = user?.role === 'ADMINISTRATOR' || user?.role === 'EDITOR';
  const canAddRole = user?.role === 'ADMINISTRATOR' || user?.role === 'EDITOR';

  const handleRefreshVenues = async () => {
    setIsRefreshingVenues(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['venues'] });
      await queryClient.refetchQueries({ queryKey: ['venues'] });
    } finally {
      setIsRefreshingVenues(false);
    }
  };

  const handleRefreshParticipants = async () => {
    setIsRefreshingParticipants(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['participants'] });
      await queryClient.refetchQueries({ queryKey: ['participants'] });
    } finally {
      setIsRefreshingParticipants(false);
    }
  };

  const handleRefreshRoles = async () => {
    setIsRefreshingRoles(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['participantRoles'] });
      await queryClient.refetchQueries({ queryKey: ['participantRoles'] });
    } finally {
      setIsRefreshingRoles(false);
    }
  };

  // Track initial values for dirty state detection
  const [initialFormState, setInitialFormState] = useState<{
    name: string;
    activityTypeId: string;
    status: Activity['status'];
    startDate: string;
    endDate: string;
    isOngoing: boolean;
  } | null>(null);

  // Track if we should bypass navigation guard (set when submitting)
  const [bypassNavigationGuard, setBypassNavigationGuard] = useState(false);

  // Navigation guard confirmation state
  const [showNavigationConfirmation, setShowNavigationConfirmation] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Fetch venue history when editing existing activity
  const { data: fetchedVenueHistory = [] } = useQuery({
    queryKey: ['activityVenues', activity?.id],
    queryFn: () => activity ? ActivityService.getActivityVenues(activity.id) : Promise.resolve([]),
    enabled: !!activity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity, // Don't automatically refetch
  });

  // Fetch participant assignments when editing existing activity
  const { data: fetchedAssignments = [] } = useQuery({
    queryKey: ['activity-participants', activity?.id],
    queryFn: () => activity ? ActivityService.getActivityParticipants(activity.id) : Promise.resolve([]),
    enabled: !!activity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity, // Don't automatically refetch
  });

  // Check if form is dirty
  const isDirty = useMemo(() => {
    if (!initialFormState) return false;
    
    // Bypass guard if we're in the process of submitting
    if (bypassNavigationGuard) return false;
    
    // Compare current state with initial state
    return (
      name !== initialFormState.name ||
      activityTypeId !== initialFormState.activityTypeId ||
      status !== initialFormState.status ||
      startDate !== initialFormState.startDate ||
      endDate !== initialFormState.endDate ||
      isOngoing !== initialFormState.isOngoing
    );
  }, [name, activityTypeId, status, startDate, endDate, isOngoing, initialFormState, bypassNavigationGuard]);

  // Navigation blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Show confirmation dialog when navigation is blocked
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowNavigationConfirmation(true);
      setPendingNavigation(() => blocker.proceed);
    }
  }, [blocker.state, blocker.proceed]);

  const handleConfirmNavigation = () => {
    setShowNavigationConfirmation(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleCancelNavigation = () => {
    setShowNavigationConfirmation(false);
    setPendingNavigation(null);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  const handleCancelClick = () => {
    // If form is dirty, the blocker will intercept and show confirmation
    // If form is clean, just navigate away
    onCancel();
  };

  // Update form state when activity prop changes
  useEffect(() => {
    // Reset bypass flag when switching modes or when activity data loads
    setBypassNavigationGuard(false);
    
    if (activity) {
      const values = {
        name: activity.name || '',
        activityTypeId: activity.activityTypeId || '',
        status: activity.status || 'PLANNED' as Activity['status'],
        startDate: activity.startDate?.split('T')[0] || '',
        endDate: activity.endDate?.split('T')[0] || '',
        isOngoing: activity.isOngoing || false,
      };
      setName(values.name);
      setActivityTypeId(values.activityTypeId);
      setStatus(values.status);
      setStartDate(values.startDate);
      setEndDate(values.endDate);
      setIsOngoing(values.isOngoing);
      setInitialFormState(values);
    } else {
      // Reset to defaults for create mode
      const emptyValues = {
        name: '',
        activityTypeId: '',
        status: 'PLANNED' as Activity['status'],
        startDate: '',
        endDate: '',
        isOngoing: false,
      };
      setName(emptyValues.name);
      setActivityTypeId(emptyValues.activityTypeId);
      setStatus(emptyValues.status);
      setStartDate(emptyValues.startDate);
      setEndDate(emptyValues.endDate);
      setIsOngoing(emptyValues.isOngoing);
      setVenueHistory([]);
      setAssignments([]);
      setInitialFormState(emptyValues);
    }
    // Clear errors when switching modes
    setNameError('');
    setActivityTypeError('');
    setStartDateError('');
    setEndDateError('');
    setError('');
    setShowVenueForm(false);
    setShowAssignmentForm(false);
  }, [activity]);

  // Update venue history when fetched data changes (separate effect to avoid resetting form fields)
  useEffect(() => {
    if (activity && fetchedVenueHistory) {
      setVenueHistory(fetchedVenueHistory);
    }
  }, [activity, fetchedVenueHistory]);

  // Update assignments when fetched data changes (separate effect to avoid resetting form fields)
  useEffect(() => {
    if (activity && fetchedAssignments) {
      setAssignments(fetchedAssignments);
    }
  }, [activity, fetchedAssignments]);

  const versionConflict = useVersionConflict({
    queryKey: ['activities'],
    onDiscard: onCancel,
  });

  const { data: activityTypes = [] } = useQuery({
    queryKey: ['activityTypes'],
    queryFn: () => ActivityTypeService.getActivityTypes(),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['participantRoles'],
    queryFn: () => ParticipantRoleService.getRoles(),
  });

  const activityTypeOptions = activityTypes.map((t) => ({
    label: t.name,
    value: t.id,
  }));

  const roleOptions = roles.map((r) => ({
    label: r.name,
    value: r.id,
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
      endDate?: string | null; // Allow null to clear endDate
      version?: number;
    }) => ActivityService.updateActivity(data.id, data),
    onSuccess: () => {
      // Set flag to bypass navigation guard
      setBypassNavigationGuard(true);
      
      // Invalidate all related queries to ensure detail page shows updated data
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      if (activity?.id) {
        queryClient.invalidateQueries({ queryKey: ['activity', activity.id] });
        queryClient.invalidateQueries({ queryKey: ['activityVenues', activity.id] });
        queryClient.invalidateQueries({ queryKey: ['activity-participants', activity.id] });
      }
      
      onSuccess();
    },
    onError: (err: Error) => {
      setBypassNavigationGuard(false);
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

  const handleDeleteVenue = async (venueHistoryId: string, e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    
    if (!activity) {
      // Remove from pending list for new activity
      setVenueHistory(prev => prev.filter(v => v.id !== venueHistoryId));
      return;
    }
    
    try {
      await ActivityService.deleteActivityVenue(activity.id, venueHistoryId);
      setVenueHistory(prev => prev.filter(v => v.id !== venueHistoryId));
    } catch (err) {
      setError('Failed to remove venue association');
    }
  };

  const validateVenueForm = (): boolean => {
    const newErrors: { venue?: string; effectiveFrom?: string; duplicate?: string } = {};

    if (!newVenueId) {
      newErrors.venue = 'Venue is required';
    }

    // effectiveFrom is now optional - only validate for duplicates if provided
    if (newVenueEffectiveFrom) {
      // Check for duplicate dates
      const isDuplicate = venueHistory.some(vh => {
        if (vh.effectiveFrom === null) return false; // Skip null dates
        const existingDate = vh.effectiveFrom.split('T')[0];
        return existingDate === newVenueEffectiveFrom;
      });

      if (isDuplicate) {
        newErrors.duplicate = 'A venue association with this effective date already exists';
      }
    } else {
      // Check if a null effectiveFrom already exists
      const hasNullDate = venueHistory.some(vh => vh.effectiveFrom === null);

      if (hasNullDate) {
        newErrors.duplicate = 'Only one venue association can have no effective date (since activity start) per activity';
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

    // Convert to ISO date or null if empty
    const isoDate = newVenueEffectiveFrom ? new Date(newVenueEffectiveFrom).toISOString() : null;

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
      try {
        // Fetch venue details so we can display the name
        const venue = await VenueService.getVenue(newVenueId);
        
        const tempVenue: ActivityVenueHistory = {
          id: `temp-${Date.now()}`,
          activityId: '',
          venueId: newVenueId,
          effectiveFrom: isoDate,
          venue: venue,
        };
        setVenueHistory(prev => [...prev, tempVenue]);
        setShowVenueForm(false);
      } catch (err) {
        setError('Failed to fetch venue details');
      }
    }
  };

  const handleCancelVenueForm = (e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setShowVenueForm(false);
    setVenueFormErrors({});
  };

  // Participant assignment management functions
  const handleAddAssignment = (e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setNewParticipantId('');
    setNewRoleId('');
    setNewNotes('');
    setAssignmentFormErrors({});
    setShowAssignmentForm(true);
  };

  const handleDeleteAssignment = async (assignmentId: string, participantId: string, e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    
    if (!activity) {
      // Remove from pending list for new activity
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
      return;
    }
    
    try {
      await AssignmentService.removeParticipant(activity.id, participantId);
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } catch (err) {
      setError('Failed to remove participant assignment');
    }
  };

  const validateAssignmentForm = (): boolean => {
    const newErrors: { participant?: string; role?: string; duplicate?: string } = {};

    if (!newParticipantId) {
      newErrors.participant = 'Participant is required';
    }

    if (!newRoleId) {
      newErrors.role = 'Role is required';
    }

    // Check for duplicate assignments (same participant + role)
    if (newParticipantId && newRoleId) {
      const isDuplicate = assignments.some(a => 
        a.participantId === newParticipantId && a.roleId === newRoleId
      );

      if (isDuplicate) {
        newErrors.duplicate = 'This participant is already assigned with this role';
      }
    }

    setAssignmentFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveAssignment = async (e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    
    if (!validateAssignmentForm()) {
      return;
    }

    if (activity) {
      // Add assignment to existing activity
      try {
        await AssignmentService.addParticipant(
          activity.id,
          newParticipantId,
          newRoleId,
          newNotes.trim() || undefined
        );
        const updated = await ActivityService.getActivityParticipants(activity.id);
        setAssignments(updated);
        setShowAssignmentForm(false);
      } catch (err) {
        setError('Failed to add participant assignment');
      }
    } else {
      // Add to pending list for new activity (will be created after activity is created)
      try {
        // Fetch participant details and find role from already-loaded roles list
        const participant = await ParticipantService.getParticipant(newParticipantId);
        const role = roles.find(r => r.id === newRoleId);
        
        if (!role) {
          setError('Selected role not found');
          return;
        }
        
        const tempAssignment: Assignment = {
          id: `temp-${Date.now()}`,
          activityId: '',
          participantId: newParticipantId,
          roleId: newRoleId,
          notes: newNotes.trim() || undefined,
          participant: participant,
          role: role,
          createdAt: new Date().toISOString(),
        };
        setAssignments(prev => [...prev, tempAssignment]);
        setShowAssignmentForm(false);
      } catch (err) {
        setError('Failed to fetch participant details');
      }
    }
  };

  const handleCancelAssignmentForm = (e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setShowAssignmentForm(false);
    setAssignmentFormErrors({});
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

    // Set flag to bypass navigation guard during submission
    setBypassNavigationGuard(true);

    // Build update data - send null for cleared fields
    const data: any = {
      name: name.trim(),
      activityTypeId,
      status: status as 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
      startDate: new Date(startDate).toISOString(),
    };

    // Handle endDate based on ongoing checkbox and field value
    // CRITICAL: When ongoing checkbox is checked, we MUST send null to clear endDate
    if (isOngoing) {
      // Ongoing checkbox is checked
      if (activity) {
        // Updating existing activity - send null to clear endDate
        data.endDate = null;
      }
      // For creates, omit endDate (don't set it) when ongoing
    } else {
      // Ongoing checkbox is NOT checked - activity should have an end date
      if (endDate) {
        // End date is provided - send it
        data.endDate = new Date(endDate).toISOString();
      } else if (activity && activity.endDate) {
        // End date is empty but activity had one - clear it
        data.endDate = null;
      }
      // For creates without endDate, omit it (validation will catch this)
    }

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
        
        // Create participant assignments if any were added
        const pendingAssignments = assignments.filter(a => a.id.startsWith('temp-'));
        for (const assignment of pendingAssignments) {
          await AssignmentService.addParticipant(
            created.id,
            assignment.participantId,
            assignment.roleId,
            assignment.notes
          );
        }
        
        queryClient.invalidateQueries({ queryKey: ['activities'] });
        queryClient.invalidateQueries({ queryKey: ['activityVenues'] });
        queryClient.invalidateQueries({ queryKey: ['activity-participants'] });
        onSuccess();
      } catch (err: any) {
        setBypassNavigationGuard(false);
        setError(err.message || 'Failed to create activity');
      }
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Sort venue history by effectiveFrom descending (most recent first)
  // Null dates (activity start) are treated as the activity startDate for sorting
  const sortedVenueHistory = [...venueHistory].sort((a, b) => {
    const dateA = a.effectiveFrom || startDate;
    const dateB = b.effectiveFrom || startDate;
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={handleCancelClick} disabled={isSubmitting} formAction="none">
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
                      <EntitySelectorWithActions
                        onRefresh={handleRefreshVenues}
                        addEntityUrl="/venues/new"
                        canAdd={canAddVenue}
                        isRefreshing={isRefreshingVenues}
                        entityTypeName="venue"
                      >
                        <AsyncEntitySelect
                          value={newVenueId}
                          onChange={(value) => {
                            setNewVenueId(value);
                            setVenueFormErrors({ ...venueFormErrors, venue: undefined, duplicate: undefined });
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
                          formatOption={(v) => ({
                            value: v.id,
                            label: v.name,
                            description: v.address,
                          })}
                          placeholder="Search for a venue"
                          invalid={!!venueFormErrors.venue}
                          ariaLabel="Select venue"
                        />
                      </EntitySelectorWithActions>
                    </FormField>
                    <FormField
                      label="Effective Start Date"
                      errorText={venueFormErrors.effectiveFrom}
                      description={
                        startDate
                          ? `The date when this venue association became effective (leave empty to use activity start date: ${startDate})`
                          : "The date when this venue association became effective (leave empty for activity start date)"
                      }
                    >
                      <DatePicker
                        value={newVenueEffectiveFrom}
                        onChange={({ detail }) => {
                          setNewVenueEffectiveFrom(detail.value);
                          setVenueFormErrors({ ...venueFormErrors, effectiveFrom: undefined, duplicate: undefined });
                        }}
                        placeholder="YYYY-MM-DD (optional)"
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

              <Table<ActivityVenueHistory>
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
                columnDefinitions={[
                  {
                    id: 'venue',
                    header: 'Venue',
                    cell: (item) => item.venue?.name || 'Unknown',
                  },
                  {
                    id: 'effectiveFrom',
                    header: 'Effective From',
                    cell: (item) => item.effectiveFrom ? formatDate(item.effectiveFrom) : (
                      <SpaceBetween direction="horizontal" size="xs">
                        <Badge color="blue">Since Activity Start</Badge>
                        {startDate && (
                          <Box variant="small" color="text-body-secondary">
                            ({startDate})
                          </Box>
                        )}
                      </SpaceBetween>
                    ),
                  },
                  {
                    id: 'actions',
                    header: 'Actions',
                    cell: (item) => (
                      <Button
                        variant="inline-icon"
                        iconName="remove"
                        onClick={(e) => handleDeleteVenue(item.id, e)}
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
            </SpaceBetween>

            {/* Embedded Participant Assignment Management */}
            <SpaceBetween size="m">
              {showAssignmentForm && (
                <Container>
                  <SpaceBetween size="m">
                    {assignmentFormErrors.duplicate && (
                      <Alert type="error">{assignmentFormErrors.duplicate}</Alert>
                    )}
                    <FormField
                      label="Participant"
                      errorText={assignmentFormErrors.participant}
                      description="Select the participant to assign"
                    >
                      <EntitySelectorWithActions
                        onRefresh={handleRefreshParticipants}
                        addEntityUrl="/participants/new"
                        canAdd={canAddParticipant}
                        isRefreshing={isRefreshingParticipants}
                        entityTypeName="participant"
                      >
                        <AsyncEntitySelect
                          value={newParticipantId}
                          onChange={(value) => {
                            setNewParticipantId(value);
                            setAssignmentFormErrors({ ...assignmentFormErrors, participant: undefined, duplicate: undefined });
                          }}
                          entityType="participant"
                          fetchFunction={async (params) => {
                            return await ParticipantService.getParticipantsFlexible({
                              page: params.page,
                              limit: params.limit,
                              geographicAreaId: params.geographicAreaId,
                              filter: params.filter,
                              fields: params.fields
                            });
                          }}
                          formatOption={(p) => ({
                            value: p.id,
                            label: p.name,
                            description: p.email,
                          })}
                          placeholder="Search for a participant"
                          invalid={!!assignmentFormErrors.participant}
                          ariaLabel="Select participant"
                        />
                      </EntitySelectorWithActions>
                    </FormField>
                    <FormField
                      label="Role"
                      errorText={assignmentFormErrors.role}
                      description="Select the role for this participant"
                    >
                      <EntitySelectorWithActions
                        onRefresh={handleRefreshRoles}
                        addEntityUrl="/configuration"
                        canAdd={canAddRole}
                        isRefreshing={isRefreshingRoles}
                        entityTypeName="role"
                      >
                        <Select
                          selectedOption={roleOptions.find((o) => o.value === newRoleId) || null}
                          onChange={({ detail }) => {
                            setNewRoleId(detail.selectedOption.value || '');
                            setAssignmentFormErrors({ ...assignmentFormErrors, role: undefined, duplicate: undefined });
                          }}
                          options={roleOptions}
                          placeholder="Select a role"
                          empty="No roles available"
                        />
                      </EntitySelectorWithActions>
                    </FormField>
                    <FormField
                      label="Notes"
                      description="Optional notes about this assignment"
                    >
                      <Textarea
                        value={newNotes}
                        onChange={({ detail }) => setNewNotes(detail.value)}
                        placeholder="Enter any notes"
                        rows={3}
                      />
                    </FormField>
                    <SpaceBetween direction="horizontal" size="xs">
                      <Button onClick={(e) => handleCancelAssignmentForm(e)}>Cancel</Button>
                      <Button variant="primary" onClick={(e) => handleSaveAssignment(e)}>
                        Add
                      </Button>
                    </SpaceBetween>
                  </SpaceBetween>
                </Container>
              )}

              <Table<Assignment>
                header={
                  <Header
                    variant="h3"
                    actions={
                      <Button
                        onClick={(e) => handleAddAssignment(e)}
                        disabled={isSubmitting}
                        iconName="add-plus"
                      >
                        Assign Participant
                      </Button>
                    }
                  >
                    Participant Assignments
                  </Header>
                }
                columnDefinitions={[
                  {
                    id: 'participant',
                    header: 'Participant',
                    cell: (item) => item.participant ? (
                      <Link href={`/participants/${item.participantId}`}>
                        {item.participant.name}
                      </Link>
                    ) : 'Unknown',
                  },
                  {
                    id: 'role',
                    header: 'Role',
                    cell: (item) => item.role?.name || 'Unknown',
                  },
                  {
                    id: 'notes',
                    header: 'Notes',
                    cell: (item) => item.notes || '-',
                  },
                  {
                    id: 'actions',
                    header: 'Actions',
                    cell: (item) => (
                      <Button
                        variant="inline-icon"
                        iconName="remove"
                        onClick={(e) => handleDeleteAssignment(item.id, item.participantId, e)}
                        disabled={isSubmitting}
                      />
                    ),
                  },
                ]}
                items={assignments}
                variant="embedded"
                empty={
                  <Box textAlign="center" color="inherit">
                    <b>No participant assignments</b>
                    <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                      Assign participants to track who is involved in this activity.
                    </Box>
                  </Box>
                }
              />
            </SpaceBetween>
          </SpaceBetween>
        </Form>
      </form>

      <VersionConflictModal
        visible={versionConflict.showConflictModal}
        conflictInfo={versionConflict.conflictInfo}
        onRetryWithLatest={versionConflict.handleRetryWithLatest}
        onDiscardChanges={versionConflict.handleDiscardChanges}
      />

      {/* Navigation guard confirmation dialog */}
      <Modal
        visible={showNavigationConfirmation}
        onDismiss={handleCancelNavigation}
        header="Unsaved Changes"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={handleCancelNavigation}>
                Stay on Page
              </Button>
              <Button variant="primary" onClick={handleConfirmNavigation}>
                Discard Changes
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.
      </Modal>
    </>
  );
}
