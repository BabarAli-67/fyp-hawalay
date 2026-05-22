import { REPORT_STEPS } from './reportFormConstants.js';

export function ReportStepProgress({ currentStep }) {
  const stepMeta = REPORT_STEPS[currentStep - 1];
  const progressPercent = (currentStep / REPORT_STEPS.length) * 100;

  return (
    <div className="mb-md" aria-label={`Step ${currentStep} of ${REPORT_STEPS.length}`}>
      <div className="flex items-center justify-between px-2 mb-xs">
        <span className="text-label-sm font-label-sm text-primary uppercase tracking-widest">
          Step {currentStep} of {REPORT_STEPS.length}
        </span>
        <span className="text-label-sm font-label-sm text-on-surface-variant">{stepMeta?.label}</span>
      </div>
      <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="flex justify-between mt-sm px-1">
        {REPORT_STEPS.map((step) => {
          const isComplete = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          return (
            <div
              key={step.id}
              className={`flex flex-col items-center gap-1 flex-1 min-w-0 ${
                isCurrent ? 'text-primary' : isComplete ? 'text-primary/70' : 'text-outline'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-colors ${
                  isCurrent
                    ? 'border-primary bg-primary text-on-primary'
                    : isComplete
                      ? 'border-primary bg-primary-container text-on-primary-container'
                      : 'border-outline-variant bg-surface-container-low'
                }`}
                aria-hidden
              >
                {isComplete ? (
                  <span className="material-symbols-outlined text-[14px]">check</span>
                ) : (
                  step.id
                )}
              </span>
              <span className="font-caption text-[10px] uppercase tracking-wide truncate max-w-full hidden xs:block sm:block">
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
