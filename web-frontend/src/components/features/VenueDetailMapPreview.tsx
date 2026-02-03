import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
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

interface VenueDetailMapPreviewProps {
  latitude: number;
  longitude: number;
}

/**
 * VenueDetailMapPreview Component
 * 
 * Displays a read-only interactive map preview showing the venue's location.
 * Used on the venue detail page when coordinates are available.
 * 
 * Features:
 * - Displays venue location as a non-draggable marker
 * - Centers map on venue's coordinates with zoom level 15 (street-level view)
 * - Allows users to zoom and pan for geographic context
 * - Uses consistent map styling with VenueFormMapView
 * - Fixed height of 400px for preview purposes
 */
export function VenueDetailMapPreview({ latitude, longitude }: VenueDetailMapPreviewProps) {
  const center: LatLngExpression = [latitude, longitude];
  const zoom = 15; // Street-level view

  return (
    <div style={{ height: '400px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center} draggable={false} />
      </MapContainer>
    </div>
  );
}
