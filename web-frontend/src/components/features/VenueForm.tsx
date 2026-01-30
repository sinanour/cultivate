import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from 'react-router-dom';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import type { Venue, GeocodingResult } from '../../types';
import { VenueService } from '../../services/api/venue.service';
import { GeocodingService } from '../../services/geocoding.service';
import { VersionConflictModal } from '../common/VersionConflictModal';
import { useVersionConflict } from '../../hooks/useVersionConflict';
import { getEntityVersion } from '../../utils/version-conflict.utils';
import { VenueFormMapView } from './VenueFormMapView';
import { GeographicAreaSelector } from '../common/GeographicAreaSelector';
import { EntitySelectorWithActions } from '../common/EntitySelectorWithActions';
import { useAuth } from '../../hooks/useAuth';
import { useGeographicAreaOptions } from '../../hooks/useGeographicAreaOptions';
import styles from './VenueForm.mobile.module.css';

interface VenueFormProps {
  venue: Venue | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function VenueForm({ venue, onSuccess, onCancel }: VenueFormProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
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

  // Geographic area options with lazy loading
  const {
    options: geographicAreas,
    isLoading: isLoadingAreas,
    handleLoadItems: handleGeographicAreaSearch,
    refetch: refetchAreas,
  } = useGeographicAreaOptions({
    ensureIncluded: venue?.geographicAreaId,
  });

  // Geographic area refresh state
  const [isRefreshingAreas, setIsRefreshingAreas] = useState(false);

  // Track initial values for dirty state detection
  const [initialFormState, setInitialFormState] = useState<{
    name: string;
    address: string;
    geographicAreaId: string;
    latitude: string;
    longitude: string;
    venueType: string;
  } | null>(null);

  // Track if we should bypass navigation guard (set when submitting)
  const [bypassNavigationGuard, setBypassNavigationGuard] = useState(false);

  // Navigation guard confirmation state
  const [showNavigationConfirmation, setShowNavigationConfirmation] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

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

  // Check if form is dirty
  const isDirty = useMemo(() => {
    if (!initialFormState) return false;
    
    // Bypass guard if we're in the process of submitting
    if (bypassNavigationGuard) return false;
    
    // Compare current state with initial state
    return (
      name !== initialFormState.name ||
      address !== initialFormState.address ||
      geographicAreaId !== initialFormState.geographicAreaId ||
      latitude !== initialFormState.latitude ||
      longitude !== initialFormState.longitude ||
      venueType !== initialFormState.venueType
    );
  }, [name, address, geographicAreaId, latitude, longitude, venueType, initialFormState, bypassNavigationGuard]);

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

  // Update form state when venue prop changes
  useEffect(() => {
    // Reset bypass flag when switching modes or when venue data loads
    setBypassNavigationGuard(false);
    
    if (venue) {
      const values = {
        name: venue.name || '',
        address: venue.address || '',
        geographicAreaId: venue.geographicAreaId || '',
        latitude: venue.latitude?.toString() || '',
        longitude: venue.longitude?.toString() || '',
        venueType: venue.venueType || '',
      };
      setName(values.name);
      setAddress(values.address);
      setGeographicAreaId(values.geographicAreaId);
      setLatitude(values.latitude);
      setLongitude(values.longitude);
      setVenueType(values.venueType);
      setInitialFormState(values);
    } else {
      // Reset to defaults for create mode
      const emptyValues = {
        name: '',
        address: '',
        geographicAreaId: '',
        latitude: '',
        longitude: '',
        venueType: '',
      };
      setName(emptyValues.name);
      setAddress(emptyValues.address);
      setGeographicAreaId(emptyValues.geographicAreaId);
      setLatitude(emptyValues.latitude);
      setLongitude(emptyValues.longitude);
      setVenueType(emptyValues.venueType);
      setInitialFormState(emptyValues);
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

  // Handler for refreshing geographic areas
  const handleRefreshAreas = async () => {
    setIsRefreshingAreas(true);
    try {
      await refetchAreas();
    } finally {
      setIsRefreshingAreas(false);
    }
  };

  // Check if user can add geographic areas
  const canAddGeographicArea = user?.role === 'ADMINISTRATOR' || user?.role === 'EDITOR';

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
      // Set flag to bypass navigation guard
      setBypassNavigationGuard(true);
      
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      if (venue?.id) {
        queryClient.invalidateQueries({ queryKey: ['venue', venue.id] });
        queryClient.invalidateQueries({ queryKey: ['venueActivities', venue.id] });
        queryClient.invalidateQueries({ queryKey: ['venueParticipants', venue.id] });
      }
      
      onSuccess();
    },
    onError: (err: Error) => {
      setBypassNavigationGuard(false);
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

    // Set flag to bypass navigation guard during submission
    setBypassNavigationGuard(true);

    // Build update data - send null for cleared fields, undefined for unchanged
    const data: any = {
      name: name.trim(),
      address: address.trim(),
      geographicAreaId,
    };

    // For optional fields: empty string means cleared (send null), non-empty means update
    if (latitude) {
      data.latitude = parseFloat(latitude);
    } else if (venue && venue.latitude !== null && venue.latitude !== undefined) {
      // Field was cleared (had value, now empty)
      data.latitude = null;
    }

    if (longitude) {
      data.longitude = parseFloat(longitude);
    } else if (venue && venue.longitude !== null && venue.longitude !== undefined) {
      data.longitude = null;
    }

    if (venueType) {
      data.venueType = venueType as 'PUBLIC_BUILDING' | 'PRIVATE_RESIDENCE';
    } else if (venue && venue.venueType) {
      data.venueType = null;
    }

    if (venue) {
      updateMutation.mutate({
        id: venue.id,
        ...data,
        version: getEntityVersion(venue),
      });
    } else {
      try {
        await createMutation.mutateAsync(data);
      } catch (err: any) {
        setBypassNavigationGuard(false);
      }
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

  const handleMapCoordinatesChange = (lat: number, lng: number) => {
    setLatitude(lat.toString());
    setLongitude(lng.toString());
    // Clear any coordinate errors when map is updated
    setLatitudeError('');
    setLongitudeError('');
  };

  // Parse coordinates for map display
  const mapLatitude = latitude && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : null;
  const mapLongitude = longitude && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : null;

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

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
            
            <div className={styles.venueFormLayout}>
              {/* Form fields */}
              <div className={styles.venueFormFields}>
                <SpaceBetween size="l">
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
                    <EntitySelectorWithActions
                      onRefresh={handleRefreshAreas}
                      addEntityUrl="/geographic-areas/new"
                      canAdd={canAddGeographicArea}
                      isRefreshing={isRefreshingAreas}
                      entityTypeName="geographic area"
                    >
                      <GeographicAreaSelector
                        value={geographicAreaId}
                        onChange={(value) => {
                          setGeographicAreaId(value || '');
                          if (geographicAreaError) validateGeographicArea(value || '');
                        }}
                        options={geographicAreas}
                        loading={isLoadingAreas}
                        disabled={isSubmitting}
                        error={geographicAreaError}
                        placeholder="Select a geographic area"
                        onLoadItems={handleGeographicAreaSearch}
                        filteringType="manual"
                      />
                    </EntitySelectorWithActions>
                  </FormField>
                  <FormField 
                    label="Coordinates" 
                    description="Optional - can be geocoded from address or adjusted on map"
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
                        formAction="none"
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
              </div>

              {/* Map view - positioned right on desktop, below on mobile */}
              <div className={styles.venueFormMap}>
                <Container>
                  <VenueFormMapView
                    latitude={mapLatitude}
                    longitude={mapLongitude}
                    onCoordinatesChange={handleMapCoordinatesChange}
                  />
                  <Box margin={{ top: 's' }} variant="small" color="text-body-secondary">
                    {mapLatitude !== null && mapLongitude !== null
                      ? 'Drag the marker or right-click to adjust the location'
                      : 'Enter coordinates, geocode the address, or use "Drop Pin" to set the location on the map'}
                  </Box>
                </Container>
              </div>
            </div>
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
