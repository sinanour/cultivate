import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ContentLayout,
  Container,
  Header,
  SpaceBetween,
  Button,
  Alert,
  Spinner,
  Box,
  Table,
  Icon,
} from '@cloudscape-design/components';
import { MergeConfirmationDialog } from '../../components/merge/MergeConfirmationDialog';
import { MergeService } from '../../services/api/merge.service';
import { ParticipantService } from '../../services/api/participant.service';
import { ActivityService } from '../../services/api/activity.service';
import { VenueService } from '../../services/api/venue.service';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import type { Participant, Activity, Venue, GeographicArea } from '../../types';

type ComplexEntityType = 'participant' | 'activity' | 'venue' | 'geographicArea';
type ComplexEntity = Participant | Activity | Venue | GeographicArea;

interface LocationState {
  sourceId: string;
  destinationId: string;
}

interface ReconciliationTableItem {
  fieldName: string;
  fieldLabel: string;
  sourceValue: any;
  destinationValue: any;
  selectedValue: 'source' | 'destination';
}

/**
 * Page for field-by-field reconciliation of complex entity merges
 * Displays table with clickable cards for source and destination values
 */
export default function ReconciliationPage() {
  const { entityType } = useParams<{ entityType: ComplexEntityType }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();

  const [sourceEntity, setSourceEntity] = useState<ComplexEntity | null>(null);
  const [destinationEntity, setDestinationEntity] = useState<ComplexEntity | null>(null);
  const [fieldSelections, setFieldSelections] = useState<Record<string, 'source' | 'destination'>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch source and destination entities
  useEffect(() => {
    if (!state?.sourceId || !state?.destinationId || !entityType) {
      setError('Missing required parameters');
      setIsLoading(false);
      return;
    }

    const fetchEntities = async () => {
      try {
        setIsLoading(true);
        const [source, destination] = await Promise.all([
          fetchEntity(entityType, state.sourceId, selectedGeographicAreaId),
          fetchEntity(entityType, state.destinationId, selectedGeographicAreaId),
        ]);

        setSourceEntity(source);
        setDestinationEntity(destination);

        // Initialize field selections with destination selected by default
        const fields = getEntityFields(entityType);
        const initialSelections: Record<string, 'source' | 'destination'> = {};

        fields.forEach(field => {
          initialSelections[field.name] = 'destination';
        });

        setFieldSelections(initialSelections);
        setIsLoading(false);
      } catch (err: any) {
        // Handle geographic authorization errors
        if (err.status === 403 || err.message?.toLowerCase().includes('geographic') || err.message?.toLowerCase().includes('authorization')) {
          setError('One or both entities are not accessible within the current geographic filter. The entities you are trying to merge may be outside your authorized area. Please adjust your geographic filter or select different entities to merge.');
        } else {
          setError(err.message || 'Failed to load entities');
        }
        setIsLoading(false);
      }
    };

    fetchEntities();
  }, [state, entityType, selectedGeographicAreaId]);

  const handleCheckboxChange = (fieldName: string, selection: 'source' | 'destination') => {
    setFieldSelections(prev => {
      const currentSelection = prev[fieldName];
      // If clicking the already-selected card, select the complementary one
      if (currentSelection === selection) {
        return { ...prev, [fieldName]: selection === 'source' ? 'destination' : 'source' };
      }
      // Otherwise, select the clicked card
      return { ...prev, [fieldName]: selection };
    });
  };

  const handleSubmit = () => {
    setShowConfirmation(true);
  };

  const handleConfirmMerge = async () => {
    if (!entityType || !sourceEntity || !destinationEntity) return;

    try {
      setIsSubmitting(true);

      // Build reconciled fields based on selections
      const fields = getEntityFields(entityType);
      const reconciledFields: Record<string, any> = {};

      fields.forEach(field => {
        const selection = fieldSelections[field.name];
        if (selection === 'source') {
          reconciledFields[field.name] = (sourceEntity as any)[field.name];
        } else {
          reconciledFields[field.name] = (destinationEntity as any)[field.name];
        }
      });

      await executeMerge(entityType, state.destinationId, state.sourceId, reconciledFields, selectedGeographicAreaId);

      // Navigate back to destination entity detail page
      navigate(getDetailPagePath(entityType, state.destinationId), {
        state: { message: 'Records merged successfully' },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to merge records');
      setShowConfirmation(false);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <ContentLayout>
        <Container>
          <SpaceBetween size="l" alignItems="center">
            <Spinner size="large" />
            <div>Loading entities...</div>
          </SpaceBetween>
        </Container>
      </ContentLayout>
    );
  }

  if (error || !sourceEntity || !destinationEntity || !entityType) {
    return (
      <ContentLayout>
        <Container>
          <Alert type="error" header="Error">
            {error || 'Failed to load entities'}
          </Alert>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Container>
      </ContentLayout>
    );
  }

  const fields = getEntityFields(entityType);
  const entityName = getEntityName(entityType);

  // Build table items
  const tableItems: ReconciliationTableItem[] = fields.map(field => ({
    fieldName: field.name,
    fieldLabel: field.label,
    sourceValue: (sourceEntity as any)[field.name],
    destinationValue: (destinationEntity as any)[field.name],
    selectedValue: fieldSelections[field.name],
  }));

  // Format value for display
  const formatValue = (value: any, field: any): string => {
    if (value === null || value === undefined) return '';
    if (field.type === 'select' && field.options) {
      const option = field.options.find((opt: any) => opt.value === value);
      return option?.label || String(value);
    }
    return String(value);
  };

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Review and select the final values for each field"
        >
          Merge {entityName}
        </Header>
      }
    >
      <Container>
        <SpaceBetween size="l">
          {error && (
            <Alert type="error" header="Error" dismissible onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Alert type="info" header="Field Reconciliation">
            Review each field and select which value to keep. By default, all destination values
            are selected. Click a card to choose the source or destination value for each field.
          </Alert>

          <Table
            columnDefinitions={[
              {
                id: 'field',
                header: 'Field',
                cell: (item: ReconciliationTableItem) => item.fieldLabel,
                width: 200,
              },
              {
                id: 'source',
                header: 'Source Value',
                cell: (item: ReconciliationTableItem) => {
                  const field = fields.find(f => f.name === item.fieldName);
                  const displayValue = formatValue(item.sourceValue, field);
                  const isSelected = item.selectedValue === 'source';

                  return (
                    <div
                      onClick={() => handleCheckboxChange(item.fieldName, 'source')}
                      style={{
                        cursor: 'pointer',
                        padding: '12px',
                        border: isSelected ? '2px solid #0972d3' : '1px solid #d5dbdb',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? '#f0f8ff' : '#ffffff',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                        {isSelected && (
                          <Icon name="check" variant="success" size="medium" />
                        )}
                        <span style={{ fontWeight: isSelected ? 'bold' : 'normal' }}>
                          {displayValue || <em>(empty)</em>}
                        </span>
                      </SpaceBetween>
                    </div>
                  );
                },
              },
              {
                id: 'destination',
                header: 'Destination Value',
                cell: (item: ReconciliationTableItem) => {
                  const field = fields.find(f => f.name === item.fieldName);
                  const displayValue = formatValue(item.destinationValue, field);
                  const isSelected = item.selectedValue === 'destination';

                  return (
                    <div
                      onClick={() => handleCheckboxChange(item.fieldName, 'destination')}
                      style={{
                        cursor: 'pointer',
                        padding: '12px',
                        border: isSelected ? '2px solid #0972d3' : '1px solid #d5dbdb',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? '#f0f8ff' : '#ffffff',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                        {isSelected && (
                          <Icon name="check" variant="success" size="medium" />
                        )}
                        <span style={{ fontWeight: isSelected ? 'bold' : 'normal' }}>
                          {displayValue || <em>(empty)</em>}
                        </span>
                      </SpaceBetween>
                    </div>
                  );
                },
              },
            ]}
            items={tableItems}
            variant="embedded"
            empty={
              <Box textAlign="center" color="inherit">
                <b>No fields to reconcile</b>
              </Box>
            }
          />

          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                Submit Merge
              </Button>
            </SpaceBetween>
          </Box>
        </SpaceBetween>
      </Container>

      <MergeConfirmationDialog
        entityType={entityName}
        sourceName={(sourceEntity as any).name}
        destinationName={(destinationEntity as any).name}
        isOpen={showConfirmation}
        onConfirm={handleConfirmMerge}
        onCancel={() => setShowConfirmation(false)}
      />
    </ContentLayout>
  );
}

/**
 * Fetch entity by type and ID
 * Note: Geographic authorization is enforced by backend middleware
 */
async function fetchEntity(
  entityType: ComplexEntityType,
  id: string,
  _geographicAreaId: string | null
): Promise<ComplexEntity> {
  switch (entityType) {
    case 'participant':
      return await ParticipantService.getParticipant(id);
    case 'activity':
      return await ActivityService.getActivity(id);
    case 'venue':
      return await VenueService.getVenue(id);
    case 'geographicArea':
      return await GeographicAreaService.getGeographicArea(id);
  }
}

/**
 * Execute merge operation
 */
async function executeMerge(
  entityType: ComplexEntityType,
  destinationId: string,
  sourceId: string,
  reconciledFields: Record<string, any>,
  geographicAreaId: string | null
) {
  switch (entityType) {
    case 'participant':
      return await MergeService.mergeParticipants(destinationId, sourceId, reconciledFields, geographicAreaId);
    case 'activity':
      return await MergeService.mergeActivities(destinationId, sourceId, reconciledFields, geographicAreaId);
    case 'venue':
      return await MergeService.mergeVenues(destinationId, sourceId, reconciledFields, geographicAreaId);
    case 'geographicArea':
      return await MergeService.mergeGeographicAreas(destinationId, sourceId, reconciledFields, geographicAreaId);
  }
}

/**
 * Get detail page path for entity type
 */
function getDetailPagePath(entityType: ComplexEntityType, id: string): string {
  switch (entityType) {
    case 'participant':
      return `/participants/${id}`;
    case 'activity':
      return `/activities/${id}`;
    case 'venue':
      return `/venues/${id}`;
    case 'geographicArea':
      return `/geographic-areas/${id}`;
  }
}

/**
 * Get human-readable entity name
 */
function getEntityName(entityType: ComplexEntityType): string {
  switch (entityType) {
    case 'participant':
      return 'Participant';
    case 'activity':
      return 'Activity';
    case 'venue':
      return 'Venue';
    case 'geographicArea':
      return 'Geographic Area';
  }
}

/**
 * Get fields for entity type
 */
function getEntityFields(entityType: ComplexEntityType) {
  switch (entityType) {
    case 'participant':
      return [
        { name: 'name', label: 'Name', type: 'text' as const },
        { name: 'email', label: 'Email', type: 'text' as const },
        { name: 'phone', label: 'Phone', type: 'text' as const },
        { name: 'nickname', label: 'Nickname', type: 'text' as const },
        { name: 'dateOfBirth', label: 'Date of Birth', type: 'date' as const },
        { name: 'dateOfRegistration', label: 'Date of Registration', type: 'date' as const },
        { name: 'notes', label: 'Notes', type: 'text' as const },
      ];
    case 'activity':
      return [
        { name: 'name', label: 'Name', type: 'text' as const },
        { name: 'startDate', label: 'Start Date', type: 'date' as const },
        { name: 'endDate', label: 'End Date', type: 'date' as const },
        {
          name: 'status', label: 'Status', type: 'select' as const, options: [
            { label: 'Planned', value: 'PLANNED' },
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Completed', value: 'COMPLETED' },
            { label: 'Cancelled', value: 'CANCELLED' },
          ]
        },
        { name: 'additionalParticipantCount', label: 'Additional Participants', type: 'number' as const },
      ];
    case 'venue':
      return [
        { name: 'name', label: 'Name', type: 'text' as const },
        { name: 'address', label: 'Address', type: 'text' as const },
        { name: 'latitude', label: 'Latitude', type: 'number' as const },
        { name: 'longitude', label: 'Longitude', type: 'number' as const },
        {
          name: 'venueType', label: 'Venue Type', type: 'select' as const, options: [
            { label: 'Public Building', value: 'PUBLIC_BUILDING' },
            { label: 'Private Residence', value: 'PRIVATE_RESIDENCE' },
          ]
        },
      ];
    case 'geographicArea':
      return [
        { name: 'name', label: 'Name', type: 'text' as const },
        {
          name: 'areaType', label: 'Area Type', type: 'select' as const, options: [
            { label: 'Neighbourhood', value: 'NEIGHBOURHOOD' },
            { label: 'Community', value: 'COMMUNITY' },
            { label: 'City', value: 'CITY' },
            { label: 'Cluster', value: 'CLUSTER' },
            { label: 'County', value: 'COUNTY' },
            { label: 'Province', value: 'PROVINCE' },
            { label: 'State', value: 'STATE' },
            { label: 'Country', value: 'COUNTRY' },
            { label: 'Continent', value: 'CONTINENT' },
            { label: 'Hemisphere', value: 'HEMISPHERE' },
            { label: 'World', value: 'WORLD' },
          ]
        },
      ];
  }
}
