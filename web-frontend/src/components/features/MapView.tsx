import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Icon, divIcon, point, type LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { ActivityService } from '../../services/api/activity.service';
import { ParticipantService } from '../../services/api/participant.service';
import { VenueService } from '../../services/api/venue.service';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import type { Activity, ActivityType, ParticipantAddressHistory, Venue } from '../../types';
import { formatDate } from '../../utils/date.utils';

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

// Custom cluster icon creator for better visual representation
const createClusterCustomIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  let sizeClass = 'marker-cluster-small';
  
  if (count >= 10) {
    sizeClass = 'marker-cluster-large';
  } else if (count >= 5) {
    sizeClass = 'marker-cluster-medium';
  }

  return divIcon({
    html: `<div class="cluster-inner"><span>${count}</span></div>`,
    className: `marker-cluster ${sizeClass}`,
    iconSize: point(40, 40, true),
  });
};

type MapMode = 'activities' | 'participantHomes' | 'venues';

interface MapViewProps {
  mode: MapMode;
  activityTypes: ActivityType[];
}

// Component to handle map bounds adjustment
function MapBoundsAdjuster({ markers }: { markers: Array<{ position: [number, number] }> }) {
  const map = useMap();
  const prevMarkersRef = useRef<string>('');

  useEffect(() => {
    if (markers.length === 0) return;

    // Create a unique key for current markers to detect changes
    const markersKey = markers.map(m => `${m.position[0]},${m.position[1]}`).sort().join('|');
    
    // Only adjust bounds if markers have changed
    if (markersKey !== prevMarkersRef.current) {
      prevMarkersRef.current = markersKey;
      
      const bounds: LatLngBoundsExpression = markers.map(m => m.position);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [markers, map]);

  return null;
}

export function MapView({ mode: mapMode, activityTypes }: MapViewProps) {
  // Get global geographic filter
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();

  // Fetch all activities with their venue history
  const { data: activities = [] } = useQuery({
    queryKey: ['activities', selectedGeographicAreaId],
    queryFn: () => ActivityService.getActivities(undefined, undefined, selectedGeographicAreaId),
  });

  // Fetch all participants with their address history
  const { data: participants = [] } = useQuery({
    queryKey: ['participants', selectedGeographicAreaId],
    queryFn: () => ParticipantService.getParticipants(undefined, undefined, selectedGeographicAreaId),
  });

  // Fetch all venues (for Venues mode)
  const { data: venues = [] } = useQuery({
    queryKey: ['venues', selectedGeographicAreaId],
    queryFn: () => VenueService.getVenues(undefined, undefined, selectedGeographicAreaId),
    enabled: mapMode === 'venues',
  });

  // Fetch venue history for all activities
  const { data: activityVenueMap = new Map() } = useQuery({
    queryKey: ['activityVenues', activities.map(a => a.id)],
    queryFn: async () => {
      const map = new Map<string, any>();
      await Promise.all(
        activities.map(async (activity) => {
          try {
            const venues = await ActivityService.getActivityVenues(activity.id);
            if (venues.length > 0) {
              // Get the most recent venue (first in the list, ordered by effectiveFrom desc)
              map.set(activity.id, venues[0]);
            }
          } catch (error) {
            console.error(`Failed to fetch venues for activity ${activity.id}:`, error);
          }
        })
      );
      return map;
    },
    enabled: activities.length > 0 && mapMode === 'activities',
  });

  // Fetch address history for all participants
  const { data: participantAddressMap = new Map() } = useQuery({
    queryKey: ['participantAddresses', participants.map(p => p.id)],
    queryFn: async () => {
      const map = new Map<string, ParticipantAddressHistory>();
      await Promise.all(
        participants.map(async (participant) => {
          try {
            const addresses = await ParticipantService.getAddressHistory(participant.id);
            if (addresses.length > 0) {
              // Get the most recent address (first in the list, ordered by effectiveFrom desc)
              map.set(participant.id, addresses[0]);
            }
          } catch (error) {
            console.error(`Failed to fetch address history for participant ${participant.id}:`, error);
          }
        })
      );
      return map;
    },
    enabled: participants.length > 0 && mapMode === 'participantHomes',
  });

  // Build activity type color map
  const activityTypeColorMap = new Map<string, string>();
  activityTypes.forEach((type, index) => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    activityTypeColorMap.set(type.id, colors[index % colors.length]);
  });

  // Prepare markers based on mode
  const markers = mapMode === 'activities'
    ? activities
        .map((activity) => {
          const venueHistory = activityVenueMap.get(activity.id);
          if (!venueHistory?.venue?.latitude || !venueHistory?.venue?.longitude) {
            return null;
          }
          return {
            id: activity.id,
            position: [venueHistory.venue.latitude, venueHistory.venue.longitude] as [number, number],
            activity,
            venue: venueHistory.venue,
            participantCount: 0, // Will be populated from assignments
          };
        })
        .filter((m) => m !== null)
    : mapMode === 'participantHomes'
    ? participants
        .map((participant) => {
          const addressHistory = participantAddressMap.get(participant.id);
          if (!addressHistory?.venue?.latitude || !addressHistory?.venue?.longitude) {
            return null;
          }
          return {
            id: participant.id,
            position: [addressHistory.venue.latitude, addressHistory.venue.longitude] as [number, number],
            participant,
            venue: addressHistory.venue,
          };
        })
        .filter((m) => m !== null)
    : // Venues mode
      venues
        .filter((venue) => venue.latitude && venue.longitude)
        .map((venue) => ({
          id: venue.id,
          position: [venue.latitude!, venue.longitude!] as [number, number],
          venue,
        }));

  // Group participant homes by venue to count participants per address
  const participantCountByVenue = new Map<string, number>();
  if (mapMode === 'participantHomes') {
    markers.forEach((marker: any) => {
      const venueId = marker.venue.id;
      participantCountByVenue.set(venueId, (participantCountByVenue.get(venueId) || 0) + 1);
    });
  }

  // Fetch participant counts for activities
  const { data: activityParticipantCounts = new Map() } = useQuery({
    queryKey: ['activityParticipantCounts', activities.map(a => a.id)],
    queryFn: async () => {
      const map = new Map<string, number>();
      await Promise.all(
        activities.map(async (activity) => {
          try {
            const participants = await ActivityService.getActivityParticipants(activity.id);
            map.set(activity.id, participants.length);
          } catch (error) {
            console.error(`Failed to fetch participants for activity ${activity.id}:`, error);
            map.set(activity.id, 0);
          }
        })
      );
      return map;
    },
    enabled: activities.length > 0 && mapMode === 'activities',
  });

  // Default center
  const defaultCenter: [number, number] = markers.length > 0
    ? markers[0].position
    : [51.505, -0.09]; // Default to London

  if (markers.length === 0) {
    const emptyMessages = {
      activities: 'Activities need venues with coordinates to display on the map.',
      participantHomes: 'Participants need home addresses with coordinates to display on the map.',
      venues: 'No venues with coordinates found. Add latitude and longitude to venues to display them on the map.',
    };

    return (
      <Box textAlign="center" padding="xxl">
        <b>No {mapMode === 'activities' ? 'activities' : mapMode === 'participantHomes' ? 'participant homes' : 'venues'} with coordinates</b>
        <Box padding={{ top: 's' }} variant="p">
          {emptyMessages[mapMode]}
        </Box>
      </Box>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <style>{`
        .marker-cluster {
          background-clip: padding-box;
          border-radius: 50%;
        }
        .marker-cluster-small {
          background-color: rgba(110, 204, 57, 0.6);
          border: 3px solid rgba(110, 204, 57, 0.9);
        }
        .marker-cluster-small .cluster-inner {
          background-color: rgba(110, 204, 57, 0.8);
        }
        .marker-cluster-medium {
          background-color: rgba(241, 211, 87, 0.6);
          border: 3px solid rgba(241, 211, 87, 0.9);
        }
        .marker-cluster-medium .cluster-inner {
          background-color: rgba(241, 211, 87, 0.8);
        }
        .marker-cluster-large {
          background-color: rgba(253, 156, 115, 0.6);
          border: 3px solid rgba(253, 156, 115, 0.9);
        }
        .marker-cluster-large .cluster-inner {
          background-color: rgba(253, 156, 115, 0.8);
        }
        .cluster-inner {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 3px;
        }
        .cluster-inner span {
          color: white;
          font-weight: bold;
          font-size: 14px;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }
        .map-legend {
          position: absolute;
          top: 10px;
          right: 10px;
          background: white;
          padding: 12px;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          z-index: 9999;
          max-width: 200px;
          pointer-events: auto;
        }
        .legend-item {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
        }
        .legend-item:last-child {
          margin-bottom: 0;
        }
        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          margin-right: 8px;
          border: 1px solid rgba(0, 0, 0, 0.2);
        }
        .legend-label {
          font-size: 13px;
          color: #333;
        }
      `}</style>

      {/* Legend (only in Activities mode) - positioned BEFORE MapContainer */}
      {mapMode === 'activities' && activityTypes.length > 0 && (
        <div className="map-legend">
          <Box variant="strong" fontSize="body-s" padding={{ bottom: 'xs' }}>
            Activity Types
          </Box>
          {activityTypes.map((type) => (
            <div key={type.id} className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: activityTypeColorMap.get(type.id) || '#3b82f6' }}
              />
              <span className="legend-label">{type.name}</span>
            </div>
          ))}
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <MapBoundsAdjuster markers={markers} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup
          maxClusterRadius={40}
          disableClusteringAtZoom={16}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          iconCreateFunction={createClusterCustomIcon}
        >
          {mapMode === 'activities'
            ? // Activities mode: show activity markers
              markers.map((marker: any) => {
                const activity = marker.activity as Activity;
                const color = activityTypeColorMap.get(activity.activityTypeId) || '#3b82f6';
                const participantCount = activityParticipantCounts.get(activity.id) || 0;

                return (
                  <Marker
                    key={activity.id}
                    position={marker.position}
                    icon={createColoredIcon(color)}
                  >
                    <Popup>
                      <div style={{ minWidth: '200px' }}>
                        <Box variant="h4">
                          <Link href={`/activities/${activity.id}`} fontSize="heading-m">
                            {activity.name}
                          </Link>
                        </Box>
                        <SpaceBetween size="xs" direction="vertical">
                          <Box variant="small" color="text-body-secondary">
                            <strong>Start Date:</strong> {formatDate(activity.startDate)}
                          </Box>
                          <Box variant="small" color="text-body-secondary">
                            <strong>Participants:</strong> {participantCount}
                          </Box>
                          {activity.activityType && (
                            <Badge color="blue">{activity.activityType.name}</Badge>
                          )}
                        </SpaceBetween>
                      </div>
                    </Popup>
                  </Marker>
                );
              })
            : mapMode === 'participantHomes'
            ? // Participant Homes mode: show unique venue markers with participant counts
              Array.from(
                markers.reduce((acc: Map<string, any>, marker: any) => {
                  const venueId = marker.venue.id;
                  if (!acc.has(venueId)) {
                    acc.set(venueId, {
                      venue: marker.venue,
                      position: marker.position,
                      count: participantCountByVenue.get(venueId) || 1,
                    });
                  }
                  return acc;
                }, new Map()).values()
              ).map((venueMarker: any) => (
                <Marker
                  key={venueMarker.venue.id}
                  position={venueMarker.position}
                  icon={DefaultIcon}
                >
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <Box variant="h4">
                        <Link href={`/venues/${venueMarker.venue.id}`} fontSize="heading-m">
                          {venueMarker.venue.name}
                        </Link>
                      </Box>
                      <SpaceBetween size="xs" direction="vertical">
                        <Box variant="small" color="text-body-secondary">
                          {venueMarker.venue.address}
                        </Box>
                        <Box variant="small" color="text-body-secondary">
                          <strong>Participants living here:</strong> {venueMarker.count}
                        </Box>
                      </SpaceBetween>
                    </div>
                  </Popup>
                </Marker>
              ))
            : // Venues mode: show all venue markers
              markers.map((marker: any) => {
                const venue = marker.venue as Venue;

                return (
                  <Marker
                    key={venue.id}
                    position={marker.position}
                    icon={DefaultIcon}
                  >
                    <Popup>
                      <div style={{ minWidth: '200px' }}>
                        <Box variant="h4">
                          <Link href={`/venues/${venue.id}`} fontSize="heading-m">
                            {venue.name}
                          </Link>
                        </Box>
                        <SpaceBetween size="xs" direction="vertical">
                          <Box variant="small" color="text-body-secondary">
                            <strong>Address:</strong> {venue.address}
                          </Box>
                          {venue.geographicArea && (
                            <Box variant="small" color="text-body-secondary">
                              <strong>Area:</strong> {venue.geographicArea.name}
                            </Box>
                          )}
                        </SpaceBetween>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
