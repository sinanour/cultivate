import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Icon, divIcon, point } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import { VenueService } from '../../services/api/venue.service';
import type { Activity } from '../../types';

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = new Icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Custom cluster icon creator for better visual representation
const createClusterCustomIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  let size = 'small';
  let sizeClass = 'marker-cluster-small';
  
  if (count >= 10) {
    size = 'large';
    sizeClass = 'marker-cluster-large';
  } else if (count >= 5) {
    size = 'medium';
    sizeClass = 'marker-cluster-medium';
  }

  return divIcon({
    html: `<div class="cluster-inner"><span>${count}</span></div>`,
    className: `marker-cluster ${sizeClass}`,
    iconSize: point(40, 40, true),
  });
};

export function MapView() {
  const { data: venues = [] } = useQuery({
    queryKey: ['venues'],
    queryFn: () => VenueService.getVenues(),
  });

  // Filter venues with coordinates
  const venuesWithCoordinates = venues.filter((v) => v.latitude && v.longitude);

  // Default center (can be made configurable)
  const defaultCenter: [number, number] = venuesWithCoordinates.length > 0
    ? [venuesWithCoordinates[0].latitude!, venuesWithCoordinates[0].longitude!]
    : [51.505, -0.09]; // Default to London

  if (venuesWithCoordinates.length === 0) {
    return (
      <Box textAlign="center" padding="xxl">
        <b>No venues with coordinates</b>
        <Box padding={{ top: 's' }} variant="p">
          Add latitude and longitude to venues to display them on the map.
        </Box>
      </Box>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%' }}>
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
      `}</style>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
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
          {venuesWithCoordinates.map((venue) => {
            // Note: Activity-venue associations would need to be fetched separately
            // For now, just show the venue marker
            const venueActivities: Activity[] = [];

            return (
              <Marker
                key={venue.id}
                position={[venue.latitude!, venue.longitude!]}
                icon={DefaultIcon}
              >
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <Box variant="h4">
                      <Link href={`/venues/${venue.id}`} fontSize="heading-m">
                        {venue.name}
                      </Link>
                    </Box>
                    <Box variant="small" color="text-body-secondary">
                      {venue.address}
                    </Box>
                    {venueActivities.length > 0 && (
                      <Box padding={{ top: 's' }}>
                        <Box variant="strong">Activities:</Box>
                        {venueActivities.map((activity) => (
                          <Box key={activity.id} padding={{ top: 'xs' }}>
                            <Link href={`/activities/${activity.id}`}>
                              {activity.name}
                            </Link>
                            {' '}
                            <Badge color={activity.status === 'ACTIVE' ? 'green' : 'grey'}>
                              {activity.status}
                            </Badge>
                          </Box>
                        ))}
                      </Box>
                    )}
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
