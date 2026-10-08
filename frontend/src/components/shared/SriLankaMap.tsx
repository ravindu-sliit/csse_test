import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons in Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom colored marker icons using CDN
const createColoredIcon = (color: 'red' | 'blue' | 'green' | 'orange' | 'yellow') => {
  const colorMap = {
    red: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    blue: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    green: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    orange: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    yellow: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  };
  return new L.Icon({
    iconUrl: colorMap[color],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

const markerIcons = {
  red: createColoredIcon('red'),
  blue: createColoredIcon('blue'),
  green: createColoredIcon('green'),
  orange: createColoredIcon('orange'),
  yellow: createColoredIcon('yellow'),
};

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color?: 'red' | 'blue' | 'green' | 'orange' | 'yellow';
}

interface SriLankaMapProps {
  pins?: MapPin[];
  height?: string;
  zoom?: number;
}

function SetView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom); }, [map, center, zoom]);
  return null;
}

export function SriLankaMap({ pins = [], height = '400px', zoom = 7 }: SriLankaMapProps) {
  const center: [number, number] = [7.8731, 80.7718]; // Sri Lanka centre

  return (
    <div style={{ height }} className="rounded-lg overflow-hidden border">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <SetView center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((pin) => (
          <Marker 
            key={pin.id} 
            position={[pin.lat, pin.lng]}
            icon={markerIcons[pin.color || 'blue']}
          >
            <Popup>
              <span className="font-semibold text-sm">{pin.label}</span>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
