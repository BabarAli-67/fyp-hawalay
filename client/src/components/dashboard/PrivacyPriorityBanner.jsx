import { Link } from 'react-router-dom';

export function PrivacyPriorityBanner() {
  return (
    <section
      className="w-full rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md md:p-lg flex gap-md items-start"
      aria-labelledby="privacy-priority-heading"
    >
      <span
        className="material-symbols-outlined text-primary text-[28px] shrink-0"
        style={{ fontVariationSettings: "'FILL' 1" }}
        aria-hidden
      >
        shield
      </span>
      <div className="min-w-0">
        <h3 id="privacy-priority-heading" className="font-h3 text-h3 text-on-surface mb-xs">
          Your Privacy, Our Priority
        </h3>
        <p className="font-body-md text-body-md text-on-surface-variant mb-sm">
          Hawalay collects only what is needed to run the service. Your personal information is
          protected with HTTPS and access controls. Contact details are shared only according to your
          chosen privacy preference (in-app chat or show email). Messages and match conversations are
          visible only to participants.
        </p>
        <Link to="/privacy" className="font-label-sm text-primary hover:underline">
          Read our Privacy Policy
        </Link>
      </div>
    </section>
  );
}
