/**
 * Hawalay map — OpenStreetMap + Leaflet (100% free, no API keys or billing).
 *
 * Why OpenStreetMap?
 * - Community-maintained map data with free tile usage policy (see OSM tile usage guidelines).
 * - Fits a student/FYP budget and PWA goals without Google Maps billing.
 *
 * How Leaflet works:
 * - MapContainer owns the map instance; TileLayer fetches raster tiles from a tile server URL.
 * - Markers/popups are DOM layers on top of the map; events (click, drag) expose lat/lng.
 *
 * Future Hawalay features this supports:
 * - Lost/found item pins from MongoDB GeoJSON ([lng, lat] → [lat, lng] for Leaflet).
 * - User geolocation (navigator.geolocation) to center the map and drop a pin.
 * - Nearby search (bounding box queries + optional free Nominatim geocoding).
 * - Multiple item markers with popups linking to item details.
 * - Route polylines (Leaflet Polyline + free OSRM public API when you add routing).
 */
import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import '../utils/leafletIcon.js';

/** MongoDB GeoJSON order: [longitude, latitude] */
export function geoJsonToLeaflet([lng, lat]) {
  return [lat, lng];
}

/** Leaflet order → MongoDB GeoJSON */
export function leafletToGeoJson([lat, lng]) {
  return [lng, lat];
}

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const DEFAULT_CENTER = [30.3753, 69.3451];
const DEFAULT_ZOOM = 5;

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        coordinates: [e.latlng.lng, e.latlng.lat],
      });
    },
  });
  return null;
}

function MapViewSync({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.setView(center, zoom ?? map.getZoom());
  }, [center, zoom, map]);
  return null;
}

/**
 * @param {object} props
 * @param {[number, number]} [props.center] - [lat, lng]
 * @param {number} [props.zoom]
 * @param {[number, number]} [props.markerPosition] - [lat, lng] primary pin
 * @param {string} [props.markerPopup]
 * @param {Array<{ position: [number, number], popup?: string }>} [props.markers]
 * @param {(payload: { lat: number, lng: number, coordinates: [number, number] }) => void} [props.onMapClick]
 * @param {string} [props.className]
 * @param {string} [props.height] - CSS height (default 12rem)
 */
export function Map({
  center,
  zoom = DEFAULT_ZOOM,
  markerPosition,
  markerPopup = 'Selected location',
  markers = [],
  onMapClick,
  className = '',
  height = '12rem',
}) {
  const mapCenter = center ?? (markerPosition ?? DEFAULT_CENTER);
  const mapZoom = markerPosition ? Math.max(zoom, 14) : zoom;

  return (
    <div
      className={`hawalay-map relative w-full overflow-hidden rounded-xl ${className}`.trim()}
      style={{ height, minHeight: height }}
    >
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        scrollWheelZoom
        className="h-full w-full z-0"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
        <MapViewSync center={mapCenter} zoom={mapZoom} />
        {onMapClick ? <MapClickHandler onMapClick={onMapClick} /> : null}
        {markerPosition ? (
          <Marker position={markerPosition}>
            <Popup>{markerPopup}</Popup>
          </Marker>
        ) : null}
        {markers.map((m) => (
          <Marker key={`${m.position[0]}-${m.position[1]}-${m.popup ?? ''}`} position={m.position}>
            {m.popup ? <Popup>{m.popup}</Popup> : null}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default Map;
