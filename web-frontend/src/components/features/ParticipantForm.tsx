import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Select from '@cloudscape-design/components/select';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import DatePicker from '@cloudscape-design/components/date-picker';
import type { Participant, ParticipantAddressHistory } from '../../types';
import { ParticipantService } from '../../services/api/participant.service';
import { VenueService } from '../../services/api/venue.service';
import { ParticipantAddressHistoryService } from '../../services/api/participant-address-history.service';
import { VersionConflictModal } from '../common/VersionConflictModal';
import { useVersionConflict } from '../../hooks/useVersionConflict';
import { getEntityVersion } from '../../utils/version-conflict.utils';

interface ParticipantFormProps {
  participant: Participant | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ParticipantForm({ participant, onSuccess, onCancel }: ParticipantFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [homeVenueId, setHomeVenueId] = useState('');
  
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');

  // Address history state
  const [addressHistory, setAddressHistory] = useState<ParticipantAddressHistory[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ParticipantAddressHistory | null>(null);
  const [newAddressVenueId, setNewAddressVenueId] = useState('');
  const [newAddressEffectiveFrom, setNewAddressEffectiveFrom] = useState('');
  const [addressFormErrors, setAddressFormErrors] = useState<{ venue?: string; effectiveFrom?: string; duplicate?: string }>({});

  // Fetch address history when editing existing participant
  const { data: fetchedAddressHistory = [] } = useQuery({
    queryKey: ['participantAddressHistory', participant?.id],
    queryFn: () => participant ? ParticipantAddressHistoryService.getAddressHistory(participant.id) : Promise.resolve([]),
    enabled: !!participant,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity, // Don't automatically refetch
  });

  // Update form state when participant prop changes
  useEffect(() => {
    if (participant) {
      setName(participant.name || '');
      setEmail(participant.email || '');
      setPhone(participant.phone || '');
      setNotes(participant.notes || '');
      // Note: homeVenueId is not on the Participant type directly, need to fetch from address history
      setHomeVenueId(''); // Will be populated from address history if needed
    } else {
      // Reset to defaults for create mode
      setName('');
      setEmail('');
      setPhone('');
      setNotes('');
      setHomeVenueId('');
      setAddressHistory([]);
    }
    // Clear errors when switching modes
    setNameError('');
    setEmailError('');
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

  const { data: venues = [] } = useQuery({
    queryKey: ['venues'],
    queryFn: () => VenueService.getVenues(),
  });

  const venueOptions = [
    { label: 'No home venue', value: '' },
    ...venues.map((v) => ({ label: v.name, value: v.id })),
  ];

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      email: string;
      phone?: string;
      notes?: string;
      homeVenueId?: string;
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
      email: string;
      phone?: string;
      notes?: string;
      homeVenueId?: string;
      version?: number;
    }) =>
      ParticipantService.updateParticipant(data.id, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        homeVenueId: data.homeVenueId,
        version: data.version,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      onSuccess();
    },
    onError: (err: Error) => {
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
    if (!trimmed) {
      setEmailError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
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
    setNewAddressEffectiveFrom(address.effectiveFrom.split('T')[0]);
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

    if (!newAddressEffectiveFrom) {
      newErrors.effectiveFrom = 'Effective start date is required';
    } else {
      // Check for duplicate dates (excluding current record if editing)
      const isDuplicate = addressHistory.some(addr => {
        const existingDate = addr.effectiveFrom.split('T')[0];
        const isCurrentRecord = editingAddress && addr.id === editingAddress.id;
        return existingDate === newAddressEffectiveFrom && !isCurrentRecord;
      });

      if (isDuplicate) {
        newErrors.duplicate = 'An address history record with this effective date already exists';
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

    const isoDate = new Date(newAddressEffectiveFrom).toISOString();

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
      const tempAddress: ParticipantAddressHistory = {
        id: `temp-${Date.now()}`,
        participantId: '',
        venueId: newAddressVenueId,
        effectiveFrom: isoDate,
        venue: venues.find(v => v.id === newAddressVenueId),
      };
      setAddressHistory(prev => [...prev, tempAddress]);
      setShowAddressForm(false);
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

    if (!isNameValid || !isEmailValid) {
      return;
    }

    const data = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      homeVenueId: homeVenueId || undefined,
    };

    if (participant) {
      updateMutation.mutate({
        id: participant.id,
        ...data,
        version: getEntityVersion(participant),
      });
    } else {
      // For new participants, create participant first, then create address history records
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
        
        queryClient.invalidateQueries({ queryKey: ['participants'] });
        queryClient.invalidateQueries({ queryKey: ['participantAddressHistory'] });
        onSuccess();
      } catch (err: any) {
        setError(err.message || 'Failed to create participant');
      }
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Sort address history by effectiveFrom descending (most recent first)
  const sortedAddressHistory = [...addressHistory].sort((a, b) => 
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
            <FormField label="Email" errorText={emailError} constraintText="Required">
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
            <FormField label="Home Venue" constraintText="Optional">
              <Select
                selectedOption={venueOptions.find((o) => o.value === homeVenueId) || venueOptions[0]}
                onChange={({ detail }) => setHomeVenueId(detail.selectedOption.value || '')}
                options={venueOptions}
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
            <Container
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
            >
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
                        <Select
                          selectedOption={venueOptions.find(o => o.value === newAddressVenueId) || null}
                          onChange={({ detail }) => {
                            setNewAddressVenueId(detail.selectedOption.value || '');
                            setAddressFormErrors({ ...addressFormErrors, venue: undefined, duplicate: undefined });
                          }}
                          options={venueOptions.filter(o => o.value !== '')}
                          placeholder="Choose a venue"
                          filteringType="auto"
                        />
                      </FormField>
                      <FormField
                        label="Effective Start Date"
                        errorText={addressFormErrors.effectiveFrom}
                        description="The date when this address became effective"
                      >
                        <DatePicker
                          value={newAddressEffectiveFrom}
                          onChange={({ detail }) => {
                            setNewAddressEffectiveFrom(detail.value);
                            setAddressFormErrors({ ...addressFormErrors, effectiveFrom: undefined, duplicate: undefined });
                          }}
                          placeholder="YYYY-MM-DD"
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

                {sortedAddressHistory.length > 0 ? (
                  <Table<ParticipantAddressHistory>
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
                ) : (
                  <Box textAlign="center" color="inherit">
                    <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                      No address history records yet. Click "Add Address" to add one.
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
