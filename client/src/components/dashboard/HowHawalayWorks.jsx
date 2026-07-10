const STEPS = [
  {
    icon: 'edit_note',
    title: 'Report',
    description: 'Upload a photo and details for a lost or found item. AI helps fill in the form.',
  },
  {
    icon: 'auto_awesome',
    title: 'AI Match',
    description: 'Hawalay compares reports using categories, location, text, and image embeddings.',
  },
  {
    icon: 'forum',
    title: 'Connect',
    description: 'When there is a strong match, chat in-app to coordinate safely with the other party.',
  },
  {
    icon: 'handshake',
    title: 'Reunite',
    description: 'Confirm the return together so both sides know the item was successfully reunited.',
  },
];

export function HowHawalayWorks() {
  return (
    <section aria-labelledby="how-hawalay-works-heading" className="w-full">
      <h3 id="how-hawalay-works-heading" className="font-h3 text-h3 text-on-surface mb-md md:mb-lg">
        How Hawalay Works
      </h3>
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sm md:gap-md lg:gap-6">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex flex-col rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-md md:p-lg shadow-sm h-full"
          >
            <div className="flex items-center gap-sm mb-sm">
              <span
                className="shrink-0 w-9 h-9 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary font-label-sm font-bold"
                aria-hidden
              >
                {index + 1}
              </span>
              <span
                className="material-symbols-outlined text-primary text-[24px]"
                aria-hidden
              >
                {step.icon}
              </span>
            </div>
            <h4 className="font-h3 text-h3 text-on-surface mb-1">{step.title}</h4>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed flex-1">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
