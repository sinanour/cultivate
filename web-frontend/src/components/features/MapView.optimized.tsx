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
import { MapDataService, type MapFilters, type ActivityMarker, type ParticipantHomeMarker, type VenueMarker, type BoundingBox } from '../../services/api/map-data.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { formatDate } from '../../utils/date.utils';
import { getActivityTypeColor, getActivityCategoryColor } from '../../utils/color.utils';
import { MapLegend } from './MapLegend';

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
  roleIds?: string[]; // NEW
  ageCohorts?: string[]; // NEW
  startDate?: string;
  endDate?: string;
  status?: string;
  onLoadingStateChange?: (state: { loadedCount: number; totalCount: number; isCancelled: boolean }) => void;
  externalIsCancelled?: boolean;
  onCancelRequest?: () => void;
  onResumeRequest?: () => void;
  readyToFetch?: boolean; // New prop to control when fetching should start
}

// Component to handle map bounds adjustment and auto-zoom
function MapBoundsAdjuster({ 
  markers, 
  allBatchesLoaded,
  hasViewportFilter 
}: { 
  markers: Array<{ position: [number, number] }>; 
  allBatchesLoaded: boolean;
  hasViewportFilter: boolean;
}) {
  const map = useMap();
  const hasAdjustedRef = useRef(false);

  useEffect(() => {
    // Only auto-zoom once when:
    // 1. All batches are loaded (not just first batch)
    // 2. Markers exist
    // 3. Haven't adjusted yet
    // 4. Viewport filtering was NOT active (no explicit viewport bounds)
    if (allBatchesLoaded && markers.length > 0 && !hasAdjustedRef.current && !hasViewportFilter) {
      hasAdjustedRef.current = true;
      const bounds: LatLngBoundsExpression = markers.map(m => m.position);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [markers, allBatchesLoaded, hasViewportFilter, map]);

  return null;
}

// Component to track viewport changes and update bounding box
function ViewportTracker({ onBoundsChange }: { onBoundsChange: (bounds: BoundingBox | undefined) => void }) {
  const map = useMap();
  const timeoutRef = useRef<number | null>(null);

  // Normalize longitude to -180 to 180 range
  const normalizeLongitude = (lon: number): number => {
    // Wrap longitude to -180 to 180 range
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    return lon;
  };

  useEffect(() => {
    const handleViewportChange = () => {
      // Debounce viewport changes (500ms)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        // Calculate the longitude span BEFORE normalization
        // This tells us how much of the world is visible
        let lonSpan = ne.lng - sw.lng;
        
        // If span is negative, we've wrapped around (shouldn't happen with Leaflet, but handle it)
        if (lonSpan < 0) {
          lonSpan += 360;
        }

        // If viewport spans more than 180 degrees, it covers most/all of the world
        // In this case, omit the bounding box filter entirely to avoid edge cases
        if (lonSpan > 180) {
          onBoundsChange(undefined); // Signal to fetch without coordinate filtering
          return;
        }

        // Normal case: viewport spans ≤ 180 degrees
        // Normalize longitude values to -180 to 180 range
        const minLon = normalizeLongitude(sw.lng);
        const maxLon = normalizeLongitude(ne.lng);

        onBoundsChange({
          minLat: Math.max(-90, Math.min(90, sw.lat)), // Clamp latitude to valid range
          maxLat: Math.max(-90, Math.min(90, ne.lat)),
          minLon,
          maxLon,
        });
      }, 300);
    };

    // Listen to map movement and zoom events
    map.on('moveend', handleViewportChange);
    map.on('zoomend', handleViewportChange);

    // Trigger initial bounds calculation
    handleViewportChange();

    return () => {
      map.off('moveend', handleViewportChange);
      map.off('zoomend', handleViewportChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [map, onBoundsChange]);

  return null;
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
  roleIds = [], // NEW
  ageCohorts = [], // NEW
  startDate,
  endDate,
  status,
  onLoadingStateChange,
  externalIsCancelled = false,
  onResumeRequest,
  readyToFetch = true, // Default to true for backward compatibility
}: MapViewProps) {
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();

  // State for viewport bounds tracking - use ref to avoid recreating fetchNextBatch
  const viewportBoundsRef = useRef<BoundingBox | undefined>(undefined);
  const viewportGenerationRef = useRef(0); // Track viewport version to detect stale fetches

  // State for batched loading
  const [allActivityMarkers, setAllActivityMarkers] = useState<ActivityMarker[]>([]);
  const [allParticipantHomeMarkers, setAllParticipantHomeMarkers] = useState<ParticipantHomeMarker[]>([]);
  const [allVenueMarkers, setAllVenueMarkers] = useState<VenueMarker[]>([]);
  const currentPageRef = useRef(1); // Use ref instead of state to avoid stale closures
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [loadingError, setLoadingError] = useState<string | undefined>();
  const [hasMorePages, setHasMorePages] = useState(true);
  const isFetchingRef = useRef(false); // Track if we're currently in a fetch cycle
  const currentFetchGenerationRef = useRef(0); // Track which viewport generation this fetch belongs to
  
  // Trigger state to force re-render when viewport changes
  const [viewportChangeCounter, setViewportChangeCounter] = useState(0);
  
  // Track if we've completed at least one successful fetch for current generation
  const [hasCompletedFetch, setHasCompletedFetch] = useState(false);
  
  // Track if user dismissed the empty state alert for current generation
  const [emptyStateDismissed, setEmptyStateDismissed] = useState(false);

  // State for legend expanded/collapsed
  const [legendExpanded, setLegendExpanded] = useState(true);

  const BATCH_SIZE = 100;

  // Use external cancelled state
  const isCancelled = externalIsCancelled;
  const isCancelledRef = useRef(isCancelled);
  const onResumeRequestRef = useRef(onResumeRequest);
  
  // Update refs when props change
  useEffect(() => {
    isCancelledRef.current = isCancelled;
    onResumeRequestRef.current = onResumeRequest;
  }, [isCancelled, onResumeRequest]);

  // Build filters
  const filters: MapFilters = {
    geographicAreaIds: selectedGeographicAreaId ? [selectedGeographicAreaId] : undefined,
    activityCategoryIds: activityCategoryIds.length > 0 ? activityCategoryIds : undefined,
    activityTypeIds: activityTypeIds.length > 0 ? activityTypeIds : undefined,
    venueIds: venueIds.length > 0 ? venueIds : undefined,
    populationIds: populationIds.length > 0 ? populationIds : undefined,
    roleIds: roleIds && roleIds.length > 0 ? roleIds : undefined, // NEW
    ageCohorts: ageCohorts && ageCohorts.length > 0 ? ageCohorts : undefined, // NEW
    startDate,
    endDate,
    status,
  };

  // Reset state when filters or mode change
  useEffect(() => {
    setAllActivityMarkers([]);
    setAllParticipantHomeMarkers([]);
    setAllVenueMarkers([]);
    currentPageRef.current = 1; // Reset page ref
    setTotalCount(0);
    setIsLoadingBatch(false);
    setLoadingError(undefined);
    setHasMorePages(true);
    isFetchingRef.current = false; // Reset fetch tracking
    viewportGenerationRef.current += 1; // Invalidate any in-flight fetches
    setHasCompletedFetch(false); // Reset fetch completion tracking
    setEmptyStateDismissed(false); // Reset dismissal state
  }, [mode, selectedGeographicAreaId, JSON.stringify(activityCategoryIds), JSON.stringify(activityTypeIds), 
    JSON.stringify(venueIds), JSON.stringify(populationIds), JSON.stringify(roleIds), JSON.stringify(ageCohorts),
    startDate, endDate, status]);

  // Handler for viewport bounds changes
  const handleBoundsChange = useCallback((bounds: BoundingBox | undefined) => {
    // Check if bounds actually changed by comparing with previous bounds
    const prevBounds = viewportBoundsRef.current;
    
    // Determine if bounds changed
    let boundsChanged = false;
    
    if (!prevBounds && bounds) {
      // First time setting bounds
      boundsChanged = true;
    } else if (prevBounds && !bounds) {
      // Bounds removed (world view)
      boundsChanged = true;
    } else if (prevBounds && bounds) {
      // Both exist - compare values
      boundsChanged = 
        prevBounds.minLat !== bounds.minLat ||
        prevBounds.maxLat !== bounds.maxLat ||
        prevBounds.minLon !== bounds.minLon ||
        prevBounds.maxLon !== bounds.maxLon;
    }
    // else: both undefined - no change
    
    // Update ref
    viewportBoundsRef.current = bounds;
    
    // Only proceed if bounds actually changed
    if (!boundsChanged) {
      return;
    }
    
    // Increment generation
    viewportGenerationRef.current += 1;
    
    // Cancel any in-progress fetch
    isFetchingRef.current = false;
    
    // If loading was paused (cancelled), treat viewport change as implicit resumption
    // Only call onResumeRequest if bounds actually changed AND this is not the initial bounds calculation
    // (prevBounds must exist for this to be a user-initiated change)
    if (isCancelledRef.current && onResumeRequestRef.current && prevBounds) {
      onResumeRequestRef.current(); // This will clear the paused state in parent component
    }
    
    // Clear state and trigger re-render
    setAllActivityMarkers([]);
    setAllParticipantHomeMarkers([]);
    setAllVenueMarkers([]);
    currentPageRef.current = 1;
    setTotalCount(0);
    setIsLoadingBatch(false);
    setLoadingError(undefined);
    setHasMorePages(true);
    setViewportChangeCounter(c => c + 1);
    setHasCompletedFetch(false); // Reset fetch completion tracking
    setEmptyStateDismissed(false); // Reset dismissal state for new viewport
  }, []); // No dependencies - use refs for all values

  // Function to fetch next batch
  const fetchNextBatch = useCallback(async () => {
    if (isLoadingBatch || !hasMorePages || isFetchingRef.current || isCancelled) return;

    // Capture the current viewport generation before starting fetch
    const fetchGeneration = viewportGenerationRef.current;
    currentFetchGenerationRef.current = fetchGeneration;

    isFetchingRef.current = true;
    setIsLoadingBatch(true);
    setLoadingError(undefined);

    try {
      // Capture current page from ref to avoid stale closure
      const pageToFetch = currentPageRef.current;
      
      if (mode === 'activitiesByType' || mode === 'activitiesByCategory') {
        const response = await MapDataService.getActivityMarkers(filters, viewportBoundsRef.current, pageToFetch, BATCH_SIZE);
        
        // Check if viewport changed while we were fetching (stale fetch)
        if (fetchGeneration !== viewportGenerationRef.current) {
          // Viewport changed - discard this result
          return;
        }
        
        // If this is the first page, replace markers instead of appending
        // This ensures filter changes clear previous results
        if (pageToFetch === 1) {
          setAllActivityMarkers(response.data);
        } else {
          setAllActivityMarkers(prev => [...prev, ...response.data]);
        }
        setTotalCount(response.pagination.total);
        setHasMorePages(pageToFetch < response.pagination.totalPages);
        currentPageRef.current = pageToFetch + 1; // Increment page ref
        setHasCompletedFetch(true); // Mark that we've completed at least one fetch
      } else if (mode === 'participantHomes') {
        const response = await MapDataService.getParticipantHomeMarkers({
          geographicAreaIds: filters.geographicAreaIds,
          populationIds: filters.populationIds,
          roleIds: filters.roleIds, // NEW
          ageCohorts: filters.ageCohorts, // NEW
          startDate: filters.startDate,
          endDate: filters.endDate,
        }, viewportBoundsRef.current, pageToFetch, BATCH_SIZE);
        
        // Check if viewport changed while we were fetching (stale fetch)
        if (fetchGeneration !== viewportGenerationRef.current) {
          // Viewport changed - discard this result
          return;
        }
        
        // If this is the first page, replace markers instead of appending
        if (pageToFetch === 1) {
          setAllParticipantHomeMarkers(response.data);
        } else {
          setAllParticipantHomeMarkers(prev => [...prev, ...response.data]);
        }
        setTotalCount(response.pagination.total);
        setHasMorePages(pageToFetch < response.pagination.totalPages);
        currentPageRef.current = pageToFetch + 1; // Increment page ref
        setHasCompletedFetch(true); // Mark that we've completed at least one fetch
      } else if (mode === 'venues') {
        const response = await MapDataService.getVenueMarkers({
          geographicAreaIds: filters.geographicAreaIds,
          roleIds: filters.roleIds, // NEW: Will be ignored by backend
          ageCohorts: filters.ageCohorts, // NEW: Will be ignored by backend
        }, viewportBoundsRef.current, pageToFetch, BATCH_SIZE);
        
        // Check if viewport changed while we were fetching (stale fetch)
        if (fetchGeneration !== viewportGenerationRef.current) {
          // Viewport changed - discard this result
          return;
        }
        
        // If this is the first page, replace markers instead of appending
        if (pageToFetch === 1) {
          setAllVenueMarkers(response.data);
        } else {
          setAllVenueMarkers(prev => [...prev, ...response.data]);
        }
        setTotalCount(response.pagination.total);
        setHasMorePages(pageToFetch < response.pagination.totalPages);
        currentPageRef.current = pageToFetch + 1; // Increment page ref
        setHasCompletedFetch(true); // Mark that we've completed at least one fetch
      }
    } catch (error) {
      console.error('Error fetching markers batch:', error);
      // Only set error if this fetch is still current
      if (fetchGeneration === viewportGenerationRef.current) {
        setLoadingError(error instanceof Error ? error.message : 'Failed to load markers');
      }
    } finally {
      // Only update loading state if this fetch is still current
      if (fetchGeneration === viewportGenerationRef.current) {
        setIsLoadingBatch(false);
        isFetchingRef.current = false;
      } else {
        // Stale fetch - just clear the fetching flag without triggering state updates
        isFetchingRef.current = false;
      }
    }
  }, [mode, filters, isLoadingBatch, hasMorePages, BATCH_SIZE, isCancelled]);

  // Calculate loaded count
  const loadedCount = mode === 'activitiesByType' || mode === 'activitiesByCategory' 
    ? allActivityMarkers.length 
    : mode === 'participantHomes' 
    ? allParticipantHomeMarkers.length 
    : allVenueMarkers.length;

  // Handle external pause/resume control
  useEffect(() => {
    if (externalIsCancelled) {
      // Pause loading
      setHasMorePages(false);
      isFetchingRef.current = false;
    } else if (!externalIsCancelled && loadedCount < totalCount && totalCount > 0) {
      // Resume loading
      setHasMorePages(true);
      // Trigger next batch fetch if not already loading
      if (!isLoadingBatch && !isFetchingRef.current) {
        fetchNextBatch();
      }
    }
  }, [externalIsCancelled, loadedCount, totalCount, isLoadingBatch, fetchNextBatch]);

  // Fetch first batch on mount or when dependencies change
  useEffect(() => {
    const hasAnyMarkers = allActivityMarkers.length > 0 || allParticipantHomeMarkers.length > 0 || allVenueMarkers.length > 0;
    // Only fetch if readyToFetch is true (filters are resolved) and viewport is initialized
    // Skip if viewport bounds exist (viewport change callback will handle it)
    if (readyToFetch && currentPageRef.current === 1 && hasMorePages && !isLoadingBatch && !hasAnyMarkers && !isFetchingRef.current && !viewportBoundsRef.current) {
      fetchNextBatch();
    }
  }, [readyToFetch, hasMorePages, isLoadingBatch, allActivityMarkers.length, allParticipantHomeMarkers.length, allVenueMarkers.length, fetchNextBatch]);

  // Auto-fetch next batch after previous batch renders
  useEffect(() => {
    // CRITICAL: Only fetch next batch if it belongs to the current viewport generation
    // This prevents old viewport batches from continuing after viewport changes
    if (!isLoadingBatch && hasMorePages && currentPageRef.current > 1) {
      // Check if the last completed fetch was for the current viewport
      if (currentFetchGenerationRef.current !== viewportGenerationRef.current) {
        // Last fetch was for an old viewport - don't continue
        return;
      }
      
      // Small delay to allow rendering of current batch
      const timer = setTimeout(() => {
        // Double-check generation hasn't changed during the delay
        if (currentFetchGenerationRef.current === viewportGenerationRef.current && !isFetchingRef.current) {
          fetchNextBatch();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isLoadingBatch, hasMorePages, fetchNextBatch]);

  // Trigger fetch when viewport changes (after state is reset)
  useEffect(() => {
    // Only trigger if we have viewport bounds, page is 1, and we're not already loading
    if (viewportBoundsRef.current && currentPageRef.current === 1 && !isLoadingBatch && !isFetchingRef.current && hasMorePages && readyToFetch && !isCancelled) {
      const hasAnyMarkers = allActivityMarkers.length > 0 || allParticipantHomeMarkers.length > 0 || allVenueMarkers.length > 0;
      if (!hasAnyMarkers) {
        // Small delay to ensure state is fully reset
        const timer = setTimeout(() => {
          fetchNextBatch();
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [viewportChangeCounter, isLoadingBatch, hasMorePages, readyToFetch, isCancelled, allActivityMarkers.length, allParticipantHomeMarkers.length, allVenueMarkers.length, fetchNextBatch]);

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

  // Determine if we should show empty state alert
  // Only show after a successful fetch completed with zero results, and user hasn't dismissed it
  const showEmptyState = markers.length === 0 && 
                         !isLoadingBatch && 
                         !loadingError && 
                         hasCompletedFetch && 
                         !emptyStateDismissed &&
                         viewportBoundsRef.current !== undefined;

  // Handler for dismissing empty state alert
  const handleDismissEmptyState = useCallback(() => {
    setEmptyStateDismissed(true);
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Show empty state alert as floating overlay */}
      {showEmptyState && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          maxWidth: '500px',
          width: '90%',
        }}>
          <Alert
            type="info"
            dismissible
            onDismiss={handleDismissEmptyState}
            header="No markers in current viewport"
          >
            Try zooming out or adjusting your filters to see markers. The map is still interactive.
          </Alert>
        </div>
      )}

      {/* Show error overlay if there's an error */}
      {loadingError && (
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
          <SpaceBetween size="s" direction="vertical">
            <Alert type="error" header="Failed to load markers">
              {loadingError}
            </Alert>
            <Button onClick={handleRetry} iconName="refresh">
              Retry
            </Button>
          </SpaceBetween>
        </div>
      )}
      
      {/* Legend - positioned absolutely over the map */}
      {mode === 'activitiesByType' && visibleActivityTypes.length > 0 && (
        <MapLegend
          title="Activity Types"
          items={visibleActivityTypes.map(type => ({
            id: type.id,
            name: type.name,
            color: getActivityTypeColor(type.id),
          }))}
          expanded={legendExpanded}
          onExpandedChange={setLegendExpanded}
        />
      )}

      {mode === 'activitiesByCategory' && visibleCategories.length > 0 && (
        <MapLegend
          title="Activity Categories"
          items={visibleCategories.map(category => ({
            id: category.id,
            name: category.name,
            color: getActivityCategoryColor(category.id),
          }))}
          expanded={legendExpanded}
          onExpandedChange={setLegendExpanded}
        />
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
        
        <ViewportTracker onBoundsChange={handleBoundsChange} />
        <MapBoundsAdjuster 
          markers={markers} 
          allBatchesLoaded={!hasMorePages && !isLoadingBatch}
          hasViewportFilter={viewportBoundsRef.current !== undefined}
        />
        
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
              <Popup autoPan={false}>
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
