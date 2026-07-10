import { Map, geoJsonToLeaflet } from '../Map.jsx';

/**
 * Map pin + optional name for primary or secondary report locations.
 */
export function LocationFieldGroup({
  formId,
  label,
  locationName,
  onLocationNameChange,
  coordinates,
  onMapSelect,
  onUseMyLocation,
  isLocating = false,
  error,
  optional = false,
  showUseMyLocation = true,
  hideSectionLabel = false,
}) {
  const mapMarkerPosition = coordinates ? geoJsonToLeaflet(coordinates) : null;
  const inputId = `${formId}-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const mapHint = coordinates
    ? 'Pinned — tap map to move'
    : showUseMyLocation
      ? 'Tap the map or use My location'
      : 'Tap the map to set a pin';

  return (
    <div className="space-y-sm">
      {hideSectionLabel ? null : (
        <label className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
          {label}
          {optional ? (
            <span className="normal-case text-on-surface-variant font-caption"> (optional)</span>
          ) : null}
        </label>
      )}
      <div className="relative rounded-xl overflow-hidden shadow-sm border border-outline-variant">
        <Map
          height="10rem"
          center={mapMarkerPosition ?? undefined}
          markerPosition={mapMarkerPosition}
          markerPopup={locationName.trim() || label}
          onMapClick={onMapSelect}
        />
        {showUseMyLocation ? (
          <div className="absolute top-2 right-2 z-[1000]">
            <button
              type="button"
              onClick={onUseMyLocation}
              disabled={isLocating}
              className="bg-surface/95 backdrop-blur-md px-sm py-xs rounded-lg shadow-md font-label-sm text-primary flex items-center gap-xs active:scale-95 transition-transform disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isLocating ? 'progress_activity' : 'my_location'}
              </span>
              {isLocating ? 'Locating…' : 'My location'}
            </button>
          </div>
        ) : null}
        <div className="absolute bottom-2 left-2 right-2 z-[1000] pointer-events-none">
          <p className="text-caption text-on-surface bg-surface/90 backdrop-blur-md px-sm py-xs rounded-lg shadow-sm truncate">
            {mapHint}
          </p>
        </div>
      </div>
      <div className="relative">
        <input
          className="peer w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none"
          id={inputId}
          value={locationName}
          onChange={onLocationNameChange}
          placeholder=" "
          autoComplete="off"
        />
        <label
          className="absolute left-md top-4 text-body-md text-on-surface-variant peer-focus:top-1 peer-focus:text-caption peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-caption transition-all"
          htmlFor={inputId}
        >
          {label} name
        </label>
        {error ? (
          <p className="mt-1 font-caption text-error" role="status">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
