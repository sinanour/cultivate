import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import type { Venue, GeocodingResult } from '../../types';
import { VenueService } from '../../services/api/venue.service';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { GeocodingService } from '../../services/geocoding.service';
import { VersionConflictModal } from '../common/VersionConflictModal';
import { useVersionConflict } from '../../hooks/useVersionConflict';
import { getEntityVersion } from '../../utils/version-conflict.utils';

interface VenueFormProps {
  venue: Venue | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function VenueForm({ venue, onSuccess, onCancel }: VenueFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [geographicAreaId, setGeographicAreaId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [venueType, setVenueType] = useState('');
  
  const [nameError, setNameError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [geographicAreaError, setGeographicAreaError] = useState('');
  const [latitudeError, setLatitudeError] = useState('');
  const [longitudeError, setLongitudeError] = useState('');
  const [error, setError] = useState('');

  // Geocoding state
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingResults, setGeocodingResults] = useState<GeocodingResult[]>([]);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update form state when venue prop changes
  useEffect(() => {
    if (venue) {
      setName(venue.name || '');
      setAddress(venue.address || '');
      setGeographicAreaId(venue.geographicAreaId || '');
      setLatitude(venue.latitude?.toString() || '');
      setLongitude(venue.longitude?.toString() || '');
      setVenueType(venue.venueType || '');
    } else {
      // Reset to defaults for create mode
      setName('');
      setAddress('');
      setGeographicAreaId('');
      setLatitude('');
      setLongitude('');
      setVenueType('');
    }
    // Clear errors when switching modes
    setNameError('');
    setAddressError('');
    setGeographicAreaError('');
    setLatitudeError('');
    setLongitudeError('');
    setError('');
  }, [venue]);

  const versionConflict = useVersionConflict({
    queryKey: ['venues'],
    onDiscard: onCancel,
  });

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
      name?: string;
      address?: string;
      geographicAreaId?: string;
      latitude?: number;
      longitude?: number;
      venueType?: 'PUBLIC_BUILDING' | 'PRIVATE_RESIDENCE';
      version?: number;
    }) => VenueService.updateVenue(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      onSuccess();
    },
    onError: (err: Error) => {
      if (!versionConflict.handleError(err)) {
        setError(err.message || 'Failed to update venue');
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
      return true;
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
      return true;
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
      updateMutation.mutate({
        id: venue.id,
        ...data,
        version: getEntityVersion(venue),
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleGeocode = async () => {
    if (!address || address.trim().length === 0) {
      setAddressError('Address is required for geocoding');
      return;
    }

    setIsGeocoding(true);
    setError('');

    try {
      const results = await GeocodingService.geocodeAddress(address);

      if (results.length === 0) {
        // No results found
        setError('Address could not be geocoded. Please check the address or enter coordinates manually.');
      } else if (results.length === 1) {
        // Single result - auto-populate
        setLatitude(results[0].latitude.toString());
        setLongitude(results[0].longitude.toString());
        setError('');
      } else {
        // Multiple results - show selection dialog
        setGeocodingResults(results);
        setShowResultsDialog(true);
      }
    } catch (err) {
      setError('Geocoding failed. Please try again or enter coordinates manually.');
      console.error('Geocoding error:', err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSelectResult = (result: GeocodingResult) => {
    setLatitude(result.latitude.toString());
    setLongitude(result.longitude.toString());
    setShowResultsDialog(false);
    setGeocodingResults([]);
    setError('');
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

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
            <FormField 
              label="Coordinates" 
              description="Optional - can be geocoded from address"
              info={!isOnline ? 'Geocoding requires internet connection' : undefined}
            >
              <SpaceBetween direction="vertical" size="xs">
                <SpaceBetween direction="horizontal" size="s">
                  <Input
                    value={latitude}
                    onChange={({ detail }) => {
                      setLatitude(detail.value);
                      if (latitudeError) validateLatitude(detail.value);
                    }}
                    onBlur={() => validateLatitude(latitude)}
                    placeholder="Latitude"
                    disabled={isSubmitting}
                    type="number"
                    inputMode="decimal"
                  />
                  <Input
                    value={longitude}
                    onChange={({ detail }) => {
                      setLongitude(detail.value);
                      if (longitudeError) validateLongitude(detail.value);
                    }}
                    onBlur={() => validateLongitude(longitude)}
                    placeholder="Longitude"
                    disabled={isSubmitting}
                    type="number"
                    inputMode="decimal"
                  />
                  <Button
                    onClick={handleGeocode}
                    loading={isGeocoding}
                    disabled={!address || !isOnline || isGeocoding || isSubmitting}
                    iconName="search"
                  >
                    Geocode Address
                  </Button>
                </SpaceBetween>
                {latitudeError && <Box color="text-status-error">{latitudeError}</Box>}
                {longitudeError && <Box color="text-status-error">{longitudeError}</Box>}
              </SpaceBetween>
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

      <VersionConflictModal
        visible={versionConflict.showConflictModal}
        conflictInfo={versionConflict.conflictInfo}
        onRetryWithLatest={versionConflict.handleRetryWithLatest}
        onDiscardChanges={versionConflict.handleDiscardChanges}
      />

      <Modal
        visible={showResultsDialog}
        onDismiss={() => {
          setShowResultsDialog(false);
          setGeocodingResults([]);
        }}
        header="Select Location"
        footer={
          <Box float="right">
            <Button
              variant="link"
              onClick={() => {
                setShowResultsDialog(false);
                setGeocodingResults([]);
              }}
            >
              Cancel
            </Button>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box>
            Multiple locations found for this address. Please select the correct one:
          </Box>
          <SpaceBetween size="s">
            {geocodingResults.map((result, index) => (
              <Button
                key={index}
                onClick={() => handleSelectResult(result)}
                fullWidth
                variant="normal"
              >
                <SpaceBetween size="xs" direction="vertical">
                  <Box fontWeight="bold">{result.displayName}</Box>
                  <Box variant="small" color="text-body-secondary">
                    Coordinates: {result.latitude.toFixed(6)}, {result.longitude.toFixed(6)}
                  </Box>
                </SpaceBetween>
              </Button>
            ))}
          </SpaceBetween>
        </SpaceBetween>
      </Modal>
    </>
  );
}
