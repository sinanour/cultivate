import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import { Button, Header } from '@cloudscape-design/components';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet with Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Configure default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface VenueFormMapViewProps {
  latitude: number | null;
  longitude: number | null;
  onCoordinatesChange: (latitude: number, longitude: number) => void;
}

/**
 * MapUpdater component to handle map centering and zoom when coordinates change
 * Preserves user-adjusted zoom level after initial setup
 * Also handles right-click events to reposition pin
 */
function MapUpdater({
  latitude,
  longitude,
  onCoordinatesChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onCoordinatesChange: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const userAdjustedZoomRef = useRef(false);
  const initialZoomSetRef = useRef(false);

  // Track when user manually adjusts zoom
  useEffect(() => {
    const handleZoomEnd = () => {
      // Mark that user has manually adjusted zoom
      userAdjustedZoomRef.current = true;
    };

    map.on('zoomend', handleZoomEnd);

    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map]);

  // Handle right-click events to reposition pin
  useMapEvents({
    contextmenu: (e) => {
      const { lat, lng } = e.latlng;
      onCoordinatesChange(lat, lng);
    },
  });

  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      // First time coordinates are populated - set zoom to 15
      if (!initialZoomSetRef.current) {
        map.setView([latitude, longitude], 15);
        initialZoomSetRef.current = true;
        userAdjustedZoomRef.current = false; // Reset user adjustment flag
      } else {
        // Subsequent updates - preserve zoom if user adjusted it
        if (userAdjustedZoomRef.current) {
          // Only pan to new center, keep current zoom
          map.panTo([latitude, longitude]);
        } else {
          // User hasn't adjusted zoom, so we can set it
          map.setView([latitude, longitude], 15);
        }
      }
    }
  }, [latitude, longitude, map]);

  return null;
}

/**
 * DraggableMarker component to handle marker drag events
 */
function DraggableMarker({
  position,
  onDragEnd,
}: {
  position: LatLngExpression;
  onDragEnd: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  const handleDragEnd = () => {
    const marker = markerRef.current;
    if (marker) {
      const { lat, lng } = marker.getLatLng();
      onDragEnd(lat, lng);
    }
  };

  return (
    <Marker
      position={position}
      draggable={true}
      eventHandlers={{
        dragend: handleDragEnd,
      }}
      ref={markerRef}
    />
  );
}

/**
 * VenueFormMapView Component
 * 
 * Displays an interactive map for venue form with draggable marker.
 * Provides two-way synchronization between coordinate inputs and map pin position.
 * 
 * Features:
 * - Displays "Drop Pin" button in map header (right-justified)
 * - When "Drop Pin" clicked, places pin at map's current center point
 * - When pin placed via "Drop Pin", updates coordinates and zooms to street-level
 * - Renders draggable marker when coordinates are provided
 * - Sets map zoom to level 15 when coordinates are first populated
 * - Tracks whether user has manually adjusted zoom level
 * - Centers map on marker when coordinates change (without resetting zoom if user-adjusted)
 * - Preserves user-adjusted zoom level during coordinate updates
 * - Handles marker drag events to extract new coordinates
 * - Handles right-click events to reposition pin
 * - Provides callback to update parent form state with new coordinates
 * - Handles empty coordinate state (no marker displayed)
 */
export function VenueFormMapView({ latitude, longitude, onCoordinatesChange }: VenueFormMapViewProps) {
  const mapRef = useRef<L.Map | null>(null);

  // Default center (world view) when no coordinates provided
  const defaultCenter: LatLngExpression = [0, 0];
  const defaultZoom = 2;

  // Use provided coordinates or default
  const center: LatLngExpression =
    latitude !== null && longitude !== null ? [latitude, longitude] : defaultCenter;
  const zoom = latitude !== null && longitude !== null ? 15 : defaultZoom;

  const hasCoordinates = latitude !== null && longitude !== null;

  const handleMarkerDragEnd = (lat: number, lng: number) => {
    onCoordinatesChange(lat, lng);
  };

  const handleDropPin = () => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      onCoordinatesChange(center.lat, center.lng);
      // Zoom to street level after dropping pin
      mapRef.current.setView(center, 16, { animate: true });
    }
  };

  return (
    <>
      <Header
        variant="h3"
        actions={
          <Button
            onClick={(e) => {
              e.preventDefault();
              handleDropPin();
            }}
            iconName="add-plus"
          >
            Drop Pin
          </Button>
        }
      >
        Map Preview
      </Header>
      <div style={{ height: '400px', width: '100%', borderRadius: '8px', overflow: 'hidden', marginTop: '8px' }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hasCoordinates && (
            <DraggableMarker position={[latitude, longitude]} onDragEnd={handleMarkerDragEnd} />
          )}
          <MapUpdater latitude={latitude} longitude={longitude} onCoordinatesChange={onCoordinatesChange} />
        </MapContainer>
      </div>
    </>
  );
}
