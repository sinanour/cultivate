import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from 'react-router-dom';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import DatePicker from '@cloudscape-design/components/date-picker';
import Badge from '@cloudscape-design/components/badge';
import Modal from '@cloudscape-design/components/modal';
import type { Participant, ParticipantAddressHistory } from '../../types';
import { ParticipantService } from '../../services/api/participant.service';
import { VenueService } from '../../services/api/venue.service';
import { ParticipantAddressHistoryService } from '../../services/api/participant-address-history.service';
import { VersionConflictModal } from '../common/VersionConflictModal';
import { useVersionConflict } from '../../hooks/useVersionConflict';
import { getEntityVersion } from '../../utils/version-conflict.utils';
import { formatDate } from '../../utils/date.utils';
import { AsyncEntitySelect } from '../common/AsyncEntitySelect';
import { EntitySelectorWithActions } from '../common/EntitySelectorWithActions';
import { PopulationMembershipManager } from '../participants/PopulationMembershipManager';
import { ParticipantPopulationService } from '../../services/api/population.service';
import { useAuth } from '../../hooks/useAuth';

interface ParticipantFormProps {
  participant: Participant | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ParticipantForm({ participant, onSuccess, onCancel }: ParticipantFormProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dateOfRegistration, setDateOfRegistration] = useState('');
  const [nickname, setNickname] = useState('');
  
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [dateOfBirthError, setDateOfBirthError] = useState('');
  const [dateOfRegistrationError, setDateOfRegistrationError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [error, setError] = useState('');

  // Address history state
  const [addressHistory, setAddressHistory] = useState<ParticipantAddressHistory[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ParticipantAddressHistory | null>(null);
  const [newAddressVenueId, setNewAddressVenueId] = useState('');
  const [newAddressEffectiveFrom, setNewAddressEffectiveFrom] = useState('');
  const [addressFormErrors, setAddressFormErrors] = useState<{ venue?: string; effectiveFrom?: string; duplicate?: string }>({});
  const [isRefreshingVenues, setIsRefreshingVenues] = useState(false);

  // Population state
  const [populationIds, setPopulationIds] = useState<string[]>([]);

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

  // Track initial values for dirty state detection
  const [initialFormState, setInitialFormState] = useState<{
    name: string;
    email: string;
    phone: string;
    notes: string;
    dateOfBirth: string;
    dateOfRegistration: string;
    nickname: string;
    populationIds: string[];
  } | null>(null);

  // Track if we should bypass navigation guard (set when submitting)
  const [bypassNavigationGuard, setBypassNavigationGuard] = useState(false);

  // Navigation guard confirmation state
  const [showNavigationConfirmation, setShowNavigationConfirmation] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Fetch address history when editing existing participant
  const { data: fetchedAddressHistory = [] } = useQuery({
    queryKey: ['participantAddressHistory', participant?.id],
    queryFn: () => participant ? ParticipantAddressHistoryService.getAddressHistory(participant.id) : Promise.resolve([]),
    enabled: !!participant,
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
    const populationsChanged = JSON.stringify([...populationIds].sort()) !== JSON.stringify([...initialFormState.populationIds].sort());
    
    return (
      name !== initialFormState.name ||
      email !== initialFormState.email ||
      phone !== initialFormState.phone ||
      notes !== initialFormState.notes ||
      dateOfBirth !== initialFormState.dateOfBirth ||
      dateOfRegistration !== initialFormState.dateOfRegistration ||
      nickname !== initialFormState.nickname ||
      populationsChanged
    );
  }, [name, email, phone, notes, dateOfBirth, dateOfRegistration, nickname, populationIds, initialFormState, bypassNavigationGuard]);

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

  // Update form state when participant prop changes
  useEffect(() => {
    // Reset bypass flag when switching modes or when participant data loads
    setBypassNavigationGuard(false);
    
    if (participant) {
      const values = {
        name: participant.name || '',
        email: participant.email || '',
        phone: participant.phone || '',
        notes: participant.notes || '',
        dateOfBirth: participant.dateOfBirth ? participant.dateOfBirth.split('T')[0] : '',
        dateOfRegistration: participant.dateOfRegistration ? participant.dateOfRegistration.split('T')[0] : '',
        nickname: participant.nickname || '',
        populationIds: [], // Will be set by PopulationMembershipManager
      };
      setName(values.name);
      setEmail(values.email);
      setPhone(values.phone);
      setNotes(values.notes);
      setDateOfBirth(values.dateOfBirth);
      setDateOfRegistration(values.dateOfRegistration);
      setNickname(values.nickname);
      setInitialFormState(values);
    } else {
      // Reset to defaults for create mode
      const emptyValues = {
        name: '',
        email: '',
        phone: '',
        notes: '',
        dateOfBirth: '',
        dateOfRegistration: '',
        nickname: '',
        populationIds: [],
      };
      setName(emptyValues.name);
      setEmail(emptyValues.email);
      setPhone(emptyValues.phone);
      setNotes(emptyValues.notes);
      setDateOfBirth(emptyValues.dateOfBirth);
      setDateOfRegistration(emptyValues.dateOfRegistration);
      setNickname(emptyValues.nickname);
      setAddressHistory([]);
      setPopulationIds([]);
      setInitialFormState(emptyValues);
    }
    // Clear errors when switching modes
    setNameError('');
    setEmailError('');
    setDateOfBirthError('');
    setDateOfRegistrationError('');
    setNicknameError('');
    setError('');
    setShowAddressForm(false);
    setEditingAddress(null);
  }, [participant]);

  // Update address history when fetched data changes (separate effect to avoid resetting form fields)
  useEffect(() => {
    if (participant && fetchedAddressHistory) {
      setAddressHistory(fetchedAddressHistory);
    }
  }, [participant, fetchedAddressHistory]);

  const versionConflict = useVersionConflict({
    queryKey: ['participants'],
    onDiscard: onCancel,
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      email?: string;
      phone?: string;
      notes?: string;
      dateOfBirth?: string;
      dateOfRegistration?: string;
      nickname?: string;
    }) => ParticipantService.createParticipant(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create participant');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string;
      name: string;
      email?: string;
      phone?: string;
      notes?: string;
      dateOfBirth?: string | null;
      dateOfRegistration?: string | null;
      nickname?: string;
      version?: number;
    }) =>
      ParticipantService.updateParticipant(data.id, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        dateOfBirth: data.dateOfBirth,
        dateOfRegistration: data.dateOfRegistration,
        nickname: data.nickname,
        version: data.version,
      }),
    onSuccess: () => {
      // Set flag to bypass navigation guard
      setBypassNavigationGuard(true);
      
      // Invalidate all related queries to ensure detail page shows updated data
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      if (participant?.id) {
        queryClient.invalidateQueries({ queryKey: ['participant', participant.id] });
        queryClient.invalidateQueries({ queryKey: ['participantAddressHistory', participant.id] });
        queryClient.invalidateQueries({ queryKey: ['participantActivities', participant.id] });
      }
      
      onSuccess();
    },
    onError: (err: Error) => {
      setBypassNavigationGuard(false);
      if (!versionConflict.handleError(err)) {
        setError(err.message || 'Failed to update participant');
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

  const validateEmail = (value: string): boolean => {
    const trimmed = value.trim();
    // Email is optional, so empty is valid
    if (!trimmed) {
      setEmailError('');
      return true;
    }
    // If provided, validate format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validateDateOfBirth = (value: string): boolean => {
    if (!value) {
      setDateOfBirthError('');
      return true;
    }
    const date = new Date(value);
    if (date >= new Date()) {
      setDateOfBirthError('Date of birth must be in the past');
      return false;
    }
    setDateOfBirthError('');
    return true;
  };

  const validateDateOfRegistration = (value: string): boolean => {
    if (!value) {
      setDateOfRegistrationError('');
      return true;
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      setDateOfRegistrationError('Please enter a valid date');
      return false;
    }
    setDateOfRegistrationError('');
    return true;
  };

  const validateNickname = (value: string): boolean => {
    if (value.length > 100) {
      setNicknameError('Nickname must be at most 100 characters');
      return false;
    }
    setNicknameError('');
    return true;
  };

  // Address history management functions
  const handleAddAddress = (e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setEditingAddress(null);
    setNewAddressVenueId('');
    setNewAddressEffectiveFrom('');
    setAddressFormErrors({});
    setShowAddressForm(true);
  };

  const handleEditAddress = (address: ParticipantAddressHistory, e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setEditingAddress(address);
    setNewAddressVenueId(address.venueId);
    setNewAddressEffectiveFrom(address.effectiveFrom ? address.effectiveFrom.split('T')[0] : '');
    setAddressFormErrors({});
    setShowAddressForm(true);
  };

  const handleDeleteAddress = async (addressId: string, e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    
    if (!participant) return;
    
    try {
      await ParticipantAddressHistoryService.deleteAddressHistory(participant.id, addressId);
      setAddressHistory(prev => prev.filter(a => a.id !== addressId));
    } catch (err) {
      setError('Failed to delete address history record');
    }
  };

  const validateAddressForm = (): boolean => {
    const newErrors: { venue?: string; effectiveFrom?: string; duplicate?: string } = {};

    if (!newAddressVenueId) {
      newErrors.venue = 'Venue is required';
    }

    // effectiveFrom is now optional - only validate for duplicates if provided
    if (newAddressEffectiveFrom) {
      // Check for duplicate dates (excluding current record if editing)
      const isDuplicate = addressHistory.some(addr => {
        if (addr.effectiveFrom === null) return false; // Skip null dates
        const existingDate = addr.effectiveFrom.split('T')[0];
        const isCurrentRecord = editingAddress && addr.id === editingAddress.id;
        return existingDate === newAddressEffectiveFrom && !isCurrentRecord;
      });

      if (isDuplicate) {
        newErrors.duplicate = 'An address history record with this effective date already exists';
      }
    } else {
      // Check if a null effectiveFrom already exists (excluding current record if editing)
      const hasNullDate = addressHistory.some(addr => {
        const isCurrentRecord = editingAddress && addr.id === editingAddress.id;
        return addr.effectiveFrom === null && !isCurrentRecord;
      });

      if (hasNullDate) {
        newErrors.duplicate = 'Only one address history record can have no effective date (initial address) per participant';
      }
    }

    setAddressFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveAddress = async (e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    
    if (!validateAddressForm()) {
      return;
    }

    // Convert to ISO date or null if empty
    const isoDate = newAddressEffectiveFrom ? new Date(newAddressEffectiveFrom).toISOString() : null;

    if (participant && editingAddress) {
      // Update existing address
      try {
        const updated = await ParticipantAddressHistoryService.updateAddressHistory(
          participant.id,
          editingAddress.id,
          { venueId: newAddressVenueId, effectiveFrom: isoDate }
        );
        setAddressHistory(prev => prev.map(a => a.id === editingAddress.id ? updated : a));
        setShowAddressForm(false);
      } catch (err) {
        setError('Failed to update address history record');
      }
    } else if (participant) {
      // Create new address for existing participant
      try {
        const created = await ParticipantAddressHistoryService.createAddressHistory(
          participant.id,
          { venueId: newAddressVenueId, effectiveFrom: isoDate }
        );
        setAddressHistory(prev => [...prev, created]);
        setShowAddressForm(false);
      } catch (err) {
        setError('Failed to create address history record');
      }
    } else {
      // Add to pending list for new participant (will be created after participant is created)
      try {
        // Fetch venue details so we can display the name
        const venue = await VenueService.getVenue(newAddressVenueId);
        
        const tempAddress: ParticipantAddressHistory = {
          id: `temp-${Date.now()}`,
          participantId: '',
          venueId: newAddressVenueId,
          effectiveFrom: isoDate,
          venue: venue,
        };
        setAddressHistory(prev => [...prev, tempAddress]);
        setShowAddressForm(false);
      } catch (err) {
        setError('Failed to fetch venue details');
      }
    }
  };

  const handleCancelAddressForm = (e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setShowAddressForm(false);
    setEditingAddress(null);
    setAddressFormErrors({});
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const isNameValid = validateName(name);
    const isEmailValid = validateEmail(email);
    const isDateOfBirthValid = validateDateOfBirth(dateOfBirth);
    const isDateOfRegistrationValid = validateDateOfRegistration(dateOfRegistration);
    const isNicknameValid = validateNickname(nickname);

    if (!isNameValid || !isEmailValid || !isDateOfBirthValid || !isDateOfRegistrationValid || !isNicknameValid) {
      return;
    }

    // Set flag to bypass navigation guard during submission
    setBypassNavigationGuard(true);

    // Build update data - send null for cleared fields, undefined for unchanged
    const data: any = {
      name: name.trim(),
    };

    // For optional fields: empty string means cleared (send null), non-empty means update
    if (email.trim()) {
      data.email = email.trim();
    } else if (participant && participant.email) {
      // Field was cleared (had value, now empty)
      data.email = null;
    }

    if (phone.trim()) {
      data.phone = phone.trim();
    } else if (participant && participant.phone) {
      data.phone = null;
    }

    if (notes.trim()) {
      data.notes = notes.trim();
    } else if (participant && participant.notes) {
      data.notes = null;
    }

    if (dateOfBirth) {
      data.dateOfBirth = new Date(dateOfBirth).toISOString();
    } else if (participant && participant.dateOfBirth) {
      data.dateOfBirth = null;
    }

    if (dateOfRegistration) {
      data.dateOfRegistration = new Date(dateOfRegistration).toISOString();
    } else if (participant && participant.dateOfRegistration) {
      data.dateOfRegistration = null;
    }

    if (nickname.trim()) {
      data.nickname = nickname.trim();
    } else if (participant && participant.nickname) {
      data.nickname = null;
    }

    if (participant) {
      // For existing participants, update participant data
      try {
        await updateMutation.mutateAsync({
          id: participant.id,
          ...data,
          version: getEntityVersion(participant),
        });

        // Sync population changes
        const initialPopIds = initialFormState?.populationIds || [];
        const currentPopIds = populationIds;

        // Find added populations (not in initial)
        const addedPopIds = currentPopIds.filter(id => !initialPopIds.includes(id));
        // Find removed populations (in initial but not in current)
        const removedPopIds = initialPopIds.filter(id => !currentPopIds.includes(id));

        // Add new populations (with error handling for duplicates)
        for (const popId of addedPopIds) {
          try {
            await ParticipantPopulationService.addParticipantToPopulation(participant.id, popId);
          } catch (err: any) {
            // Ignore duplicate errors (population already added)
            if (err.response?.data?.code !== 'DUPLICATE_ASSOCIATION') {
              throw err;
            }
          }
        }

        // Remove populations
        for (const popId of removedPopIds) {
          try {
            await ParticipantPopulationService.removeParticipantFromPopulation(participant.id, popId);
          } catch (err: any) {
            // Ignore not found errors (population already removed)
            if (err.response?.data?.code !== 'NOT_FOUND') {
              throw err;
            }
          }
        }

        // Update initial state to reflect saved populations
        setInitialFormState(prev => prev ? { ...prev, populationIds: currentPopIds } : null);

        queryClient.invalidateQueries({ queryKey: ['participantPopulations', participant.id] });
      } catch (err: any) {
        setBypassNavigationGuard(false);
        setError(err.message || 'Failed to update participant');
      }
    } else {
      // For new participants, create participant first, then create address history records and population associations
      try {
        const created = await ParticipantService.createParticipant(data);
        
        // Create address history records if any were added
        const pendingAddresses = addressHistory.filter(a => a.id.startsWith('temp-'));
        for (const addr of pendingAddresses) {
          await ParticipantAddressHistoryService.createAddressHistory(created.id, {
            venueId: addr.venueId,
            effectiveFrom: addr.effectiveFrom,
          });
        }
        
        // Create population associations if any were selected
        for (const popId of populationIds) {
          try {
            await ParticipantPopulationService.addParticipantToPopulation(created.id, popId);
          } catch (err: any) {
            // Ignore duplicate errors (population already added)
            if (err.response?.data?.code !== 'DUPLICATE_ASSOCIATION') {
              throw err;
            }
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ['participants'] });
        queryClient.invalidateQueries({ queryKey: ['participantAddressHistory'] });
        queryClient.invalidateQueries({ queryKey: ['participantPopulations', created.id] });
        onSuccess();
      } catch (err: any) {
        setBypassNavigationGuard(false);
        setError(err.message || 'Failed to create participant');
      }
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Sort address history by effectiveFrom descending (most recent first)
  // Null dates (initial address) sort to the end (oldest)
  const sortedAddressHistory = [...addressHistory].sort((a, b) => {
    if (a.effectiveFrom === null && b.effectiveFrom === null) return 0;
    if (a.effectiveFrom === null) return 1; // null goes to end (oldest)
    if (b.effectiveFrom === null) return -1; // null goes to end (oldest)
    return new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime();
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
                {participant ? 'Update' : 'Create'}
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
                placeholder="Enter participant name"
                disabled={isSubmitting}
              />
            </FormField>
            <FormField label="Email" errorText={emailError} constraintText="Optional">
              <Input
                value={email}
                onChange={({ detail }) => {
                  setEmail(detail.value);
                  if (emailError) validateEmail(detail.value);
                }}
                onBlur={() => validateEmail(email)}
                type="email"
                placeholder="Enter email address"
                disabled={isSubmitting}
              />
            </FormField>
            <FormField label="Phone" constraintText="Optional">
              <Input
                value={phone}
                onChange={({ detail }) => setPhone(detail.value)}
                placeholder="Enter phone number"
                disabled={isSubmitting}
              />
            </FormField>
            <FormField label="Nickname" errorText={nicknameError} constraintText="Optional (max 100 characters)">
              <Input
                value={nickname}
                onChange={({ detail }) => {
                  setNickname(detail.value);
                  if (nicknameError) validateNickname(detail.value);
                }}
                onBlur={() => validateNickname(nickname)}
                placeholder="Enter nickname"
                disabled={isSubmitting}
              />
            </FormField>
            <FormField label="Date of Birth" errorText={dateOfBirthError} constraintText="Optional">
              <DatePicker
                value={dateOfBirth}
                onChange={({ detail }) => {
                  setDateOfBirth(detail.value);
                  if (dateOfBirthError) validateDateOfBirth(detail.value);
                }}
                onBlur={() => validateDateOfBirth(dateOfBirth)}
                placeholder="YYYY-MM-DD"
                disabled={isSubmitting}
              />
            </FormField>
            <FormField label="Date of Registration" errorText={dateOfRegistrationError} constraintText="Optional">
              <DatePicker
                value={dateOfRegistration}
                onChange={({ detail }) => {
                  setDateOfRegistration(detail.value);
                  if (dateOfRegistrationError) validateDateOfRegistration(detail.value);
                }}
                onBlur={() => validateDateOfRegistration(dateOfRegistration)}
                placeholder="YYYY-MM-DD"
                disabled={isSubmitting}
              />
            </FormField>
            <FormField label="Notes" constraintText="Optional">
              <Textarea
                value={notes}
                onChange={({ detail }) => setNotes(detail.value)}
                placeholder="Enter any additional notes"
                disabled={isSubmitting}
                rows={4}
              />
            </FormField>

            {/* Embedded Address History Management */}
            <SpaceBetween size="m">
              {showAddressForm && (
                <Container>
                  <SpaceBetween size="m">
                    {addressFormErrors.duplicate && (
                      <Alert type="error">{addressFormErrors.duplicate}</Alert>
                    )}
                    <FormField
                      label="Venue"
                      errorText={addressFormErrors.venue}
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
                          value={newAddressVenueId}
                          onChange={(value) => {
                            setNewAddressVenueId(value);
                            setAddressFormErrors({ ...addressFormErrors, venue: undefined, duplicate: undefined });
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
                          invalid={!!addressFormErrors.venue}
                          ariaLabel="Select venue"
                        />
                      </EntitySelectorWithActions>
                    </FormField>
                    <FormField
                      label="Effective Start Date"
                      errorText={addressFormErrors.effectiveFrom}
                      description="The date when this address became effective (leave empty for initial address)"
                    >
                      <DatePicker
                        value={newAddressEffectiveFrom}
                        onChange={({ detail }) => {
                          setNewAddressEffectiveFrom(detail.value);
                          setAddressFormErrors({ ...addressFormErrors, effectiveFrom: undefined, duplicate: undefined });
                        }}
                        placeholder="YYYY-MM-DD (optional)"
                      />
                    </FormField>
                    <SpaceBetween direction="horizontal" size="xs">
                      <Button onClick={(e) => handleCancelAddressForm(e)}>Cancel</Button>
                      <Button variant="primary" onClick={(e) => handleSaveAddress(e)}>
                        {editingAddress ? 'Update' : 'Add'}
                      </Button>
                    </SpaceBetween>
                  </SpaceBetween>
                </Container>
              )}

              <Table<ParticipantAddressHistory>
                header={
                  <Header
                    variant="h3"
                    actions={
                      <Button
                        onClick={(e) => handleAddAddress(e)}
                        disabled={isSubmitting}
                        iconName="add-plus"
                      >
                        Add Address
                      </Button>
                    }
                  >
                    Address History
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
                      <Badge color="blue">Initial Address</Badge>
                    ),
                  },
                  {
                    id: 'actions',
                    header: 'Actions',
                    cell: (item) => (
                      <SpaceBetween direction="horizontal" size="xs">
                        {participant && (
                          <Button
                            variant="inline-icon"
                            iconName="edit"
                            onClick={(e) => handleEditAddress(item, e)}
                            disabled={isSubmitting}
                          />
                        )}
                        <Button
                          variant="inline-icon"
                          iconName="remove"
                          onClick={(e) => {
                            e?.preventDefault();
                            e?.stopPropagation();
                            if (participant) {
                              handleDeleteAddress(item.id, e);
                            } else {
                              setAddressHistory(prev => prev.filter(a => a.id !== item.id));
                            }
                          }}
                          disabled={isSubmitting}
                        />
                      </SpaceBetween>
                    ),
                  },
                ]}
                items={sortedAddressHistory}
                variant="embedded"
                empty={
                  <Box textAlign="center" color="inherit">
                    <b>No address history</b>
                    <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                      Add address history records to track where this participant has lived.
                    </Box>
                  </Box>
                }
              />
            </SpaceBetween>

            {/* Embedded Population Membership Management */}
            <PopulationMembershipManager 
              participantId={participant?.id || null}
              value={populationIds}
              onChange={setPopulationIds}
              onInitialLoad={(ids) => {
                // Update initial state when populations are first loaded
                setInitialFormState(prev => prev ? { ...prev, populationIds: ids } : null);
              }}
              disabled={isSubmitting}
            />
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

