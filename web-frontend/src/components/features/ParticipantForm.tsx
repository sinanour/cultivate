import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Select from '@cloudscape-design/components/select';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import type { Participant } from '../../types';
import { ParticipantService } from '../../services/api/participant.service';
import { VenueService } from '../../services/api/venue.service';

interface ParticipantFormProps {
  participant: Participant | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ParticipantForm({ participant, onSuccess, onCancel }: ParticipantFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(participant?.name || '');
  const [email, setEmail] = useState(participant?.email || '');
  const [phone, setPhone] = useState(participant?.phone || '');
  const [notes, setNotes] = useState(participant?.notes || '');
  const [homeVenueId, setHomeVenueId] = useState(participant?.homeVenueId || '');
  
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');

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
    }) =>
      ParticipantService.updateParticipant(data.id, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        homeVenueId: data.homeVenueId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update participant');
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
      updateMutation.mutate({ id: participant.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" loading={isLoading} disabled={isLoading} formAction="submit">
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
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </FormField>
          <FormField label="Phone" constraintText="Optional">
            <Input
              value={phone}
              onChange={({ detail }) => setPhone(detail.value)}
              placeholder="Enter phone number"
              disabled={isLoading}
            />
          </FormField>
          <FormField label="Home Venue" constraintText="Optional">
            <Select
              selectedOption={venueOptions.find((o) => o.value === homeVenueId) || venueOptions[0]}
              onChange={({ detail }) => setHomeVenueId(detail.selectedOption.value || '')}
              options={venueOptions}
              disabled={isLoading}
            />
          </FormField>
          <FormField label="Notes" constraintText="Optional">
            <Textarea
              value={notes}
              onChange={({ detail }) => setNotes(detail.value)}
              placeholder="Enter any additional notes"
              disabled={isLoading}
              rows={4}
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </form>
  );
}
