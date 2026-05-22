import { LocationFieldGroup } from '../LocationFieldGroup.jsx';
import { ReportSection } from '../ReportSection.jsx';

export function ReportStepLocationContact({
  formId,
  locationName,
  onLocationNameChange,
  locationCoordinates,
  onPrimaryMapSelect,
  onPrimaryUseMyLocation,
  isLocatingPrimary,
  secondaryLocationName,
  onSecondaryLocationNameChange,
  secondaryLocationCoordinates,
  onSecondaryMapSelect,
  onSecondaryUseMyLocation,
  isLocatingSecondary,
  contactPreference,
  onContactPreferenceChange,
  fieldErrors,
}) {
  return (
    <>
      <ReportSection
        title="Location Information"
        subtitle="Primary location is required. Add a secondary area if the item may have moved."
      >
        <p className="font-caption text-on-surface-variant -mt-sm">
          Free OpenStreetMap — no API key required.
        </p>
        <LocationFieldGroup
          formId={formId}
          label="Primary location"
          locationName={locationName}
          onLocationNameChange={onLocationNameChange}
          coordinates={locationCoordinates}
          onMapSelect={onPrimaryMapSelect}
          onUseMyLocation={onPrimaryUseMyLocation}
          isLocating={isLocatingPrimary}
          error={fieldErrors.locationName}
        />
        <LocationFieldGroup
          formId={formId}
          label="Secondary location"
          optional
          locationName={secondaryLocationName}
          onLocationNameChange={onSecondaryLocationNameChange}
          coordinates={secondaryLocationCoordinates}
          onMapSelect={onSecondaryMapSelect}
          onUseMyLocation={onSecondaryUseMyLocation}
          isLocating={isLocatingSecondary}
        />
      </ReportSection>

      <ReportSection title="Contact Preferences" subtitle="How matched users can reach you.">
        <fieldset className="space-y-sm">
          <legend className="sr-only">Contact preference</legend>
          <label className="flex items-start gap-sm cursor-pointer">
            <input
              type="radio"
              name={`${formId}-contact`}
              value="in_app_chat"
              checked={contactPreference === 'in_app_chat'}
              onChange={() => onContactPreferenceChange('in_app_chat')}
              className="mt-1 accent-primary"
            />
            <span className="font-body-md text-on-surface">
              Allow matched users to contact me via in-app chat
              <span className="block font-caption text-on-surface-variant">Default — for future Socket.io chat</span>
            </span>
          </label>
          <label className="flex items-start gap-sm cursor-pointer">
            <input
              type="radio"
              name={`${formId}-contact`}
              value="show_email"
              checked={contactPreference === 'show_email'}
              onChange={() => onContactPreferenceChange('show_email')}
              className="mt-1 accent-primary"
            />
            <span className="font-body-md text-on-surface">
              Show my email instead
              <span className="block font-caption text-on-surface-variant">Displayed on match cards when enabled</span>
            </span>
          </label>
        </fieldset>
      </ReportSection>
    </>
  );
}
