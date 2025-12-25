import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import type { Venue } from '../../types';
import { VenueService } from '../../services/api/venue.service';
import { GeographicAreaService } from '../../services/api/geographic-area.service';

interface VenueFormProps {
  venue: Venue | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function VenueForm({ venue, onSuccess, onCancel }: VenueFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(venue?.name || '');
  const [address, setAddress] = useState(venue?.address || '');
  const [geographicAreaId, setGeographicAreaId] = useState(venue?.geographicAreaId || '');
  const [latitude, setLatitude] = useState(venue?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(venue?.longitude?.toString() || '');
  const [venueType, setVenueType] = useState(venue?.venueType || '');
  
  const [nameError, setNameError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [geographicAreaError, setGeographicAreaError] = useState('');
  const [latitudeError, setLatitudeError] = useState('');
  const [longitudeError, setLongitudeError] = useState('');
  const [error, setError] = useState('');

  const { data: geographicAreas = [] } = useQuery({
    queryKey: ['geographicAreas'],
    queryFn: () => GeographicAreaService.getGeographicAreas(),
  });

  const geographicAreaOptions = geographicAreas.map((area) => ({
    label: area.name,
    value: area.id,
  }));

  const venueTypeOptions = [
    { label: 'Not specified', value: '' },
    { label: 'Public Building', value: 'PUBLIC_BUILDING' },
    { label: 'Private Residence', value: 'PRIVATE_RESIDENCE' },
  ];

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      address: string;
      geographicAreaId: string;
      latitude?: number;
      longitude?: number;
      venueType?: 'PUBLIC_BUILDING' | 'PRIVATE_RESIDENCE';
    }) => VenueService.createVenue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create venue');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string;
      name: string;
      address: string;
      geographicAreaId: string;
      latitude?: number;
      longitude?: number;
      venueType?: 'PUBLIC_BUILDING' | 'PRIVATE_RESIDENCE';
    }) =>
      VenueService.updateVenue(data.id, {
        name: data.name,
        address: data.address,
        geographicAreaId: data.geographicAreaId,
        latitude: data.latitude,
        longitude: data.longitude,
        venueType: data.venueType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update venue');
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

  const validateAddress = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setAddressError('Address is required');
      return false;
    }
    setAddressError('');
    return true;
  };

  const validateGeographicArea = (value: string): boolean => {
    if (!value) {
      setGeographicAreaError('Geographic area is required');
      return false;
    }
    setGeographicAreaError('');
    return true;
  };

  const validateLatitude = (value: string): boolean => {
    if (!value) {
      setLatitudeError('');
      return true; // Optional field
    }
    const num = parseFloat(value);
    if (isNaN(num) || num < -90 || num > 90) {
      setLatitudeError('Latitude must be between -90 and 90');
      return false;
    }
    setLatitudeError('');
    return true;
  };

  const validateLongitude = (value: string): boolean => {
    if (!value) {
      setLongitudeError('');
      return true; // Optional field
    }
    const num = parseFloat(value);
    if (isNaN(num) || num < -180 || num > 180) {
      setLongitudeError('Longitude must be between -180 and 180');
      return false;
    }
    setLongitudeError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const isNameValid = validateName(name);
    const isAddressValid = validateAddress(address);
    const isGeographicAreaValid = validateGeographicArea(geographicAreaId);
    const isLatitudeValid = validateLatitude(latitude);
    const isLongitudeValid = validateLongitude(longitude);

    if (!isNameValid || !isAddressValid || !isGeographicAreaValid || !isLatitudeValid || !isLongitudeValid) {
      return;
    }

    const data = {
      name: name.trim(),
      address: address.trim(),
      geographicAreaId,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      venueType: venueType ? (venueType as 'PUBLIC_BUILDING' | 'PRIVATE_RESIDENCE') : undefined,
    };

    if (venue) {
      updateMutation.mutate({ id: venue.id, ...data });
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
              {venue ? 'Update' : 'Create'}
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
              placeholder="Enter venue name"
              disabled={isSubmitting}
            />
          </FormField>
          <FormField label="Address" errorText={addressError} constraintText="Required">
            <Input
              value={address}
              onChange={({ detail }) => {
                setAddress(detail.value);
                if (addressError) validateAddress(detail.value);
              }}
              onBlur={() => validateAddress(address)}
              placeholder="Enter venue address"
              disabled={isSubmitting}
            />
          </FormField>
          <FormField label="Geographic Area" errorText={geographicAreaError} constraintText="Required">
            <Select
              selectedOption={geographicAreaOptions.find((o) => o.value === geographicAreaId) || null}
              onChange={({ detail }) => {
                setGeographicAreaId(detail.selectedOption.value || '');
                if (geographicAreaError) validateGeographicArea(detail.selectedOption.value || '');
              }}
              options={geographicAreaOptions}
              placeholder="Select a geographic area"
              disabled={isSubmitting}
              empty="No geographic areas available"
            />
          </FormField>
          <FormField label="Latitude" errorText={latitudeError} constraintText="Optional (-90 to 90)">
            <Input
              value={latitude}
              onChange={({ detail }) => {
                setLatitude(detail.value);
                if (latitudeError) validateLatitude(detail.value);
              }}
              onBlur={() => validateLatitude(latitude)}
              placeholder="Enter latitude"
              disabled={isSubmitting}
              type="number"
              inputMode="decimal"
            />
          </FormField>
          <FormField label="Longitude" errorText={longitudeError} constraintText="Optional (-180 to 180)">
            <Input
              value={longitude}
              onChange={({ detail }) => {
                setLongitude(detail.value);
                if (longitudeError) validateLongitude(detail.value);
              }}
              onBlur={() => validateLongitude(longitude)}
              placeholder="Enter longitude"
              disabled={isSubmitting}
              type="number"
              inputMode="decimal"
            />
          </FormField>
          <FormField label="Venue Type" constraintText="Optional">
            <Select
              selectedOption={venueTypeOptions.find((o) => o.value === venueType) || venueTypeOptions[0]}
              onChange={({ detail }) => setVenueType(detail.selectedOption.value || '')}
              options={venueTypeOptions}
              disabled={isSubmitting}
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </form>
  );
}
