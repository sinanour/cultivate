import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Icon, divIcon, point, type LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Box from '@cloudscape-design/components/box';
import Link from '@cloudscape-design/components/link';
import Spinner from '@cloudscape-design/components/spinner';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Alert from '@cloudscape-design/components/alert';
import { MapDataService, type MapFilters, type ActivityMarker, type ParticipantHomeMarker, type VenueMarker } from '../../services/api/map-data.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { formatDate } from '../../utils/date.utils';
import { getActivityTypeColor, getActivityCategoryColor } from '../../utils/color.utils';

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = new Icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Function to create colored marker icon using SVG
const createColoredIcon = (color: string) => {
  const svgIcon = `
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.4 12.5 28.5 12.5 28.5S25 20.9 25 12.5C25 5.6 19.4 0 12.5 0z" 
            fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12.5" cy="12.5" r="5" fill="white" opacity="0.9"/>
    </svg>
  `;
  
  const iconUrl = `data:image/svg+xml;base64,${btoa(svgIcon)}`;
  
  return new Icon({
    iconUrl,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
};

// Custom cluster icon creator with colored background
const createClusterCustomIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  let size = 40;
  let backgroundColor = '#00802fa0';
  
  if (count >= 100) {
    size = 60;
  } else if (count >= 50) {
    size = 50;
  } else if (count >= 10) {
    size = 45;
  }

  return divIcon({
    html: `
      <div style="
        background-color: ${backgroundColor};
        border: 3px solid white;
        border-radius: 50%;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      ">
        <span style="
          color: white;
          font-weight: bold;
          font-size: ${size >= 50 ? '18px' : '14px'};
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        ">${count}</span>
      </div>
    `,
    className: '',
    iconSize: point(size, size, true),
  });
};

type MapMode = 'activitiesByType' | 'activitiesByCategory' | 'participantHomes' | 'venues';

interface MapViewProps {
  mode: MapMode;
  populationIds?: string[];
  activityCategoryIds?: string[];
  activityTypeIds?: string[];
  venueIds?: string[];
  startDate?: string;
  endDate?: string;
  status?: string;
  onLoadingStateChange?: (state: { loadedCount: number; totalCount: number; isCancelled: boolean }) => void;
}

// Component to handle map bounds adjustment and auto-zoom
function MapBoundsAdjuster({ markers, isLoading }: { markers: Array<{ position: [number, number] }>; isLoading: boolean }) {
  const map = useMap();
  const hasAdjustedRef = useRef(false);

  useEffect(() => {
    // Only auto-zoom once when markers first load
    if (!isLoading && markers.length > 0 && !hasAdjustedRef.current) {
      hasAdjustedRef.current = true;
      const bounds: LatLngBoundsExpression = markers.map(m => m.position);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [markers, isLoading, map]);

  return null;
}

// Loading overlay component with progress indicator
function MapLoadingOverlay({ 
  isLoading, 
  loadedCount, 
  totalCount,
  error,
  onRetry,
  onCancel,
  isCancelled
}: { 
  isLoading: boolean;
  loadedCount: number;
  totalCount: number;
  error?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  isCancelled?: boolean;
}) {
  // Show loading overlay if there's an error OR if we haven't loaded all markers yet AND not cancelled
  const showLoading = !isCancelled && ((loadedCount < totalCount && totalCount > 0) || (isLoading && totalCount === 0));
  
  if (!showLoading && !error) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 1000,
      background: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      minWidth: '250px',
    }}>
      {error ? (
        <SpaceBetween size="s" direction="vertical">
          <Alert type="error" header="Failed to load markers">
            {error}
          </Alert>
          {onRetry && (
            <Button onClick={onRetry} iconName="refresh">
              Retry
            </Button>
          )}
        </SpaceBetween>
      ) : (
        <SpaceBetween size="s" direction="vertical">
          <SpaceBetween size="s" direction="horizontal">
            <Spinner />
            <Box>Loading markers...</Box>
          </SpaceBetween>
          {totalCount > 0 && (
            <Box textAlign="center" variant="small">
              {loadedCount} / {totalCount}
            </Box>
          )}
          {onCancel && (
            <Button onClick={onCancel} variant="link">
              Cancel
            </Button>
          )}
        </SpaceBetween>
      )}
    </div>
  );
}

// Lazy-loaded popup content component
function LazyPopupContent({ 
  markerId, 
  mode,
  activityCategoryId
}: { 
  markerId: string; 
  mode: MapMode;
  activityCategoryId?: string;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['mapPopup', mode, markerId],
    queryFn: async () => {
      if (mode === 'activitiesByType' || mode === 'activitiesByCategory') {
        return MapDataService.getActivityPopupContent(markerId);
      } else if (mode === 'participantHomes') {
        return MapDataService.getParticipantHomePopupContent(markerId);
      } else if (mode === 'venues') {
        return MapDataService.getVenuePopupContent(markerId);
      }
      return null;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (isLoading) {
    return (
      <div style={{ minWidth: '200px' }}>
        <SpaceBetween size="s" direction="horizontal">
          <Spinner size="normal" />
          <Box>Loading...</Box>
        </SpaceBetween>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minWidth: '200px' }}>
        <Box color="text-status-error">
          Failed to load details. Please try again.
        </Box>
      </div>
    );
  }

  if (!data) {
    return <div style={{ minWidth: '200px' }}><Box>No data available</Box></div>;
  }

  // Render based on mode - matching original MapView.tsx styling exactly
  if (mode === 'activitiesByType') {
    const activityData = data as any;
    return (
      <div style={{ minWidth: '200px' }}>
        <Box variant="h4">
          <Link href={`/activities/${activityData.id}`} fontSize="heading-m">
            {activityData.name}
          </Link>
        </Box>
        <SpaceBetween size="xs" direction="vertical">
          <Box variant="small" color="text-body-secondary">
            <strong>Category:</strong> {activityData.activityCategoryName}
          </Box>
          <Box variant="small" color="text-body-secondary">
            <strong>Type:</strong> {activityData.activityTypeName}
          </Box>
          <Box variant="small" color="text-body-secondary">
            <strong>Start Date:</strong> {formatDate(activityData.startDate)}
          </Box>
          <Box variant="small" color="text-body-secondary">
            <strong>Participants:</strong> {activityData.participantCount}
          </Box>
        </SpaceBetween>
      </div>
    );
  } else if (mode === 'activitiesByCategory') {
    const activityData = data as any;
    const color = activityCategoryId ? getActivityCategoryColor(activityCategoryId) : '#3b82f6';
    return (
      <div style={{ minWidth: '200px' }}>
        <Box variant="h4">
          <Link href={`/activities/${activityData.id}`} fontSize="heading-m">
            {activityData.name}
          </Link>
        </Box>
        <SpaceBetween size="xs" direction="vertical">
          <Box variant="small" color="text-body-secondary">
            <strong>Category:</strong> {activityData.activityCategoryName}
          </Box>
          <Box variant="small" color="text-body-secondary">
            <strong>Type:</strong> {activityData.activityTypeName}
          </Box>
          <Box variant="small" color="text-body-secondary">
            <strong>Start Date:</strong> {formatDate(activityData.startDate)}
          </Box>
          <Box variant="small" color="text-body-secondary">
            <strong>Participants:</strong> {activityData.participantCount}
          </Box>
          <div style={{ 
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: color,
            color: 'white',
            fontSize: '12px',
            fontWeight: '500',
          }}>
            {activityData.activityCategoryName}
          </div>
        </SpaceBetween>
      </div>
    );
  } else if (mode === 'participantHomes') {
    const homeData = data as any;
    return (
      <div style={{ minWidth: '200px' }}>
        <Box variant="h4">
          <Link href={`/venues/${homeData.venueId}`} fontSize="heading-m">
            {homeData.venueName}
          </Link>
        </Box>
        <SpaceBetween size="xs" direction="vertical">
          <Box variant="small" color="text-body-secondary">
            {homeData.venueName}
          </Box>
          <Box variant="small" color="text-body-secondary">
            <strong>Participants living here:</strong> {homeData.participantCount}
          </Box>
        </SpaceBetween>
      </div>
    );
  } else if (mode === 'venues') {
    const venueData = data as any;
    return (
      <div style={{ minWidth: '200px' }}>
        <Box variant="h4">
          <Link href={`/venues/${venueData.id}`} fontSize="heading-m">
            {venueData.name}
          </Link>
        </Box>
        <SpaceBetween size="xs" direction="vertical">
          <Box variant="small" color="text-body-secondary">
            <strong>Address:</strong> {venueData.address}
          </Box>
          <Box variant="small" color="text-body-secondary">
            <strong>Area:</strong> {venueData.geographicAreaName}
          </Box>
        </SpaceBetween>
      </div>
    );
  }

  return null;
}

export function MapView({ 
  mode, 
  populationIds = [],
  activityCategoryIds = [],
  activityTypeIds = [],
  venueIds = [],
  startDate,
  endDate,
  status,
  onLoadingStateChange
}: MapViewProps) {
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();

  // State for batched loading
  const [allActivityMarkers, setAllActivityMarkers] = useState<ActivityMarker[]>([]);
  const [allParticipantHomeMarkers, setAllParticipantHomeMarkers] = useState<ParticipantHomeMarker[]>([]);
  const [allVenueMarkers, setAllVenueMarkers] = useState<VenueMarker[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [loadingError, setLoadingError] = useState<string | undefined>();
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isCancelled, setIsCancelled] = useState(false);
  const isFetchingRef = useRef(false); // Track if we're currently in a fetch cycle

  const BATCH_SIZE = 100;

  // Build filters
  const filters: MapFilters = {
    geographicAreaIds: selectedGeographicAreaId ? [selectedGeographicAreaId] : undefined,
    activityCategoryIds: activityCategoryIds.length > 0 ? activityCategoryIds : undefined,
    activityTypeIds: activityTypeIds.length > 0 ? activityTypeIds : undefined,
    venueIds: venueIds.length > 0 ? venueIds : undefined,
    populationIds: populationIds.length > 0 ? populationIds : undefined,
    startDate,
    endDate,
    status,
  };

  // Reset state when filters or mode change
  useEffect(() => {
    setAllActivityMarkers([]);
    setAllParticipantHomeMarkers([]);
    setAllVenueMarkers([]);
    setCurrentPage(1);
    setTotalCount(0);
    setIsLoadingBatch(false);
    setLoadingError(undefined);
    setHasMorePages(true);
    setIsCancelled(false);
    isFetchingRef.current = false; // Reset fetch tracking
  }, [mode, selectedGeographicAreaId, JSON.stringify(activityCategoryIds), JSON.stringify(activityTypeIds), 
      JSON.stringify(venueIds), JSON.stringify(populationIds), startDate, endDate, status]);

  // Cancel loading handler
  const handleCancelLoading = useCallback(() => {
    setIsCancelled(true);
    setHasMorePages(false);
    isFetchingRef.current = false;
  }, []);

  // Function to fetch next batch
  const fetchNextBatch = useCallback(async () => {
    if (isLoadingBatch || !hasMorePages || isFetchingRef.current || isCancelled) return;

    isFetchingRef.current = true;
    setIsLoadingBatch(true);
    setLoadingError(undefined);

    try {
      if (mode === 'activitiesByType' || mode === 'activitiesByCategory') {
        const response = await MapDataService.getActivityMarkers(filters, currentPage, BATCH_SIZE);
        setAllActivityMarkers(prev => [...prev, ...response.data]);
        setTotalCount(response.pagination.total);
        setHasMorePages(currentPage < response.pagination.totalPages);
        setCurrentPage(prev => prev + 1);
      } else if (mode === 'participantHomes') {
        const response = await MapDataService.getParticipantHomeMarkers({
          geographicAreaIds: filters.geographicAreaIds,
          populationIds: filters.populationIds,
        }, currentPage, BATCH_SIZE);
        setAllParticipantHomeMarkers(prev => [...prev, ...response.data]);
        setTotalCount(response.pagination.total);
        setHasMorePages(currentPage < response.pagination.totalPages);
        setCurrentPage(prev => prev + 1);
      } else if (mode === 'venues') {
        const response = await MapDataService.getVenueMarkers({
          geographicAreaIds: filters.geographicAreaIds,
        }, currentPage, BATCH_SIZE);
        setAllVenueMarkers(prev => [...prev, ...response.data]);
        setTotalCount(response.pagination.total);
        setHasMorePages(currentPage < response.pagination.totalPages);
        setCurrentPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error fetching markers batch:', error);
      setLoadingError(error instanceof Error ? error.message : 'Failed to load markers');
    } finally {
      setIsLoadingBatch(false);
      isFetchingRef.current = false;
    }
  }, [mode, filters, currentPage, isLoadingBatch, hasMorePages, BATCH_SIZE]);

  // Fetch first batch on mount or when dependencies change
  useEffect(() => {
    const hasAnyMarkers = allActivityMarkers.length > 0 || allParticipantHomeMarkers.length > 0 || allVenueMarkers.length > 0;
    if (currentPage === 1 && hasMorePages && !isLoadingBatch && !hasAnyMarkers && !isFetchingRef.current) {
      fetchNextBatch();
    }
  }, [currentPage, hasMorePages, isLoadingBatch, allActivityMarkers.length, allParticipantHomeMarkers.length, allVenueMarkers.length, fetchNextBatch]);

  // Auto-fetch next batch after previous batch renders
  useEffect(() => {
    if (!isLoadingBatch && hasMorePages && currentPage > 1) {
      // Small delay to allow rendering of current batch
      const timer = setTimeout(() => {
        fetchNextBatch();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoadingBatch, hasMorePages, currentPage, fetchNextBatch]);

  // Retry function
  const handleRetry = useCallback(() => {
    setLoadingError(undefined);
    fetchNextBatch();
  }, [fetchNextBatch]);

  // Fetch activity types and categories for legend
  const { data: activityTypesData = [] } = useQuery({
    queryKey: ['activityTypes'],
    queryFn: () => ActivityTypeService.getActivityTypes(),
  });

  // Build unique categories from activity types
  const uniqueCategories = new Map<string, { id: string; name: string }>();
  activityTypesData.forEach((type) => {
    if (type.activityCategory) {
      uniqueCategories.set(type.activityCategory.id, {
        id: type.activityCategory.id,
        name: type.activityCategory.name,
      });
    }
  });

  // Calculate loaded count
  const loadedCount = mode === 'activitiesByType' || mode === 'activitiesByCategory' 
    ? allActivityMarkers.length 
    : mode === 'participantHomes' 
    ? allParticipantHomeMarkers.length 
    : allVenueMarkers.length;

  // Notify parent of loading state changes
  useEffect(() => {
    if (onLoadingStateChange) {
      onLoadingStateChange({ loadedCount, totalCount, isCancelled });
    }
  }, [loadedCount, totalCount, isCancelled, onLoadingStateChange]);

  // Prepare markers for rendering
  const markers: Array<{ 
    position: [number, number]; 
    id: string; 
    icon?: Icon; 
    activityTypeId?: string;
    activityCategoryId?: string;
  }> = [];

  if (mode === 'activitiesByType') {
    allActivityMarkers.forEach((marker: ActivityMarker) => {
      const color = getActivityTypeColor(marker.activityTypeId);
      markers.push({
        position: [marker.latitude, marker.longitude],
        id: marker.id,
        icon: createColoredIcon(color),
        activityTypeId: marker.activityTypeId,
      });
    });
  } else if (mode === 'activitiesByCategory') {
    allActivityMarkers.forEach((marker: ActivityMarker) => {
      const color = getActivityCategoryColor(marker.activityCategoryId);
      markers.push({
        position: [marker.latitude, marker.longitude],
        id: marker.id,
        icon: createColoredIcon(color),
        activityCategoryId: marker.activityCategoryId,
      });
    });
  } else if (mode === 'participantHomes') {
    allParticipantHomeMarkers.forEach((marker: ParticipantHomeMarker) => {
      markers.push({
        position: [marker.latitude, marker.longitude],
        id: marker.venueId,
        icon: DefaultIcon,
      });
    });
  } else if (mode === 'venues') {
    allVenueMarkers.forEach((marker: VenueMarker) => {
      markers.push({
        position: [marker.latitude, marker.longitude],
        id: marker.id,
        icon: DefaultIcon,
      });
    });
  }

  // Filter legend items to only show those visible on the map
  const visibleActivityTypeIds = new Set(
    markers.filter(m => m.activityTypeId).map(m => m.activityTypeId!)
  );
  const visibleActivityTypes = activityTypesData.filter(type => visibleActivityTypeIds.has(type.id));

  const visibleCategoryIds = new Set(
    markers.filter(m => m.activityCategoryId).map(m => m.activityCategoryId!)
  );
  const visibleCategories = Array.from(uniqueCategories.values()).filter(cat => visibleCategoryIds.has(cat.id));

  // Show empty state if no markers and not loading
  if (markers.length === 0 && !isLoadingBatch && !loadingError) {
    const emptyMessages = {
      activitiesByType: 'Activities need venues with coordinates to display on the map.',
      activitiesByCategory: 'Activities need venues with coordinates to display on the map.',
      participantHomes: 'Participants need home addresses with coordinates to display on the map.',
      venues: 'No venues with coordinates found. Add latitude and longitude to venues to display them on the map.',
    };

    return (
      <Box textAlign="center" padding="xxl">
        <b>No markers to display</b>
        <Box padding={{ top: 's' }} variant="p">
          {emptyMessages[mode]}
        </Box>
      </Box>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapLoadingOverlay 
        isLoading={isLoadingBatch} 
        loadedCount={loadedCount}
        totalCount={totalCount}
        error={loadingError}
        onRetry={handleRetry}
        onCancel={handleCancelLoading}
        isCancelled={isCancelled}
      />
      
      {/* Legend - positioned absolutely over the map */}
      {mode === 'activitiesByType' && visibleActivityTypes.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'white',
          padding: '12px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          maxWidth: '200px',
          pointerEvents: 'auto',
        }}>
          <Box variant="strong" fontSize="body-s" padding={{ bottom: 'xs' }}>
            Activity Types
          </Box>
          {visibleActivityTypes.map((type) => (
            <div key={type.id} style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '6px',
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                marginRight: '8px',
                border: '1px solid rgba(0, 0, 0, 0.2)',
                backgroundColor: getActivityTypeColor(type.id),
              }} />
              <span style={{
                fontSize: '13px',
                color: '#333',
                whiteSpace: 'nowrap',
              }}>{type.name}</span>
            </div>
          ))}
        </div>
      )}

      {mode === 'activitiesByCategory' && visibleCategories.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'white',
          padding: '12px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          maxWidth: '200px',
          pointerEvents: 'auto',
        }}>
          <Box variant="strong" fontSize="body-s" padding={{ bottom: 'xs' }}>
            Activity Categories
          </Box>
          {visibleCategories.map((category) => (
            <div key={category.id} style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '6px',
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                marginRight: '8px',
                border: '1px solid rgba(0, 0, 0, 0.2)',
                backgroundColor: getActivityCategoryColor(category.id),
              }} />
              <span style={{
                fontSize: '13px',
                color: '#333',
                whiteSpace: 'nowrap',
              }}>{category.name}</span>
            </div>
          ))}
        </div>
      )}
      
      <MapContainer
        center={[20, 0]} // World center
        zoom={2} // World zoom level
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBoundsAdjuster markers={markers} isLoading={isLoadingBatch && currentPage === 1} />
        
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
          maxClusterRadius={40}
          disableClusteringAtZoom={16}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
        >
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              position={marker.position}
              icon={marker.icon || DefaultIcon}
            >
              <Popup>
                <LazyPopupContent 
                  markerId={marker.id} 
                  mode={mode}
                  activityCategoryId={marker.activityCategoryId}
                />
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
