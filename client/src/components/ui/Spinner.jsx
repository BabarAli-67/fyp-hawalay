/**
 * real_time_chat.html — typing indicator dots (animate-bounce);
 * report_lost_item.html — footer uses bg-surface/80 backdrop-blur-xl (full-page shell).
 */
const DOT =
  'w-1.5 h-1.5 bg-outline-variant rounded-full animate-bounce';

const DOT_ROW = 'flex space-x-1';

const FULL_PAGE_SHELL =
  'fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-xl';

export function Spinner({ variant = 'inline', className = '', ...rest }) {
  if (variant === 'fullPage') {
    return (
      <div className={FULL_PAGE_SHELL} {...rest}>
        <div className={`${DOT_ROW} ${className}`.trim()} role="status" aria-busy="true">
          <span className={DOT} />
          <span className={DOT} style={{ animationDelay: '0.2s' }} />
          <span className={DOT} style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`${DOT_ROW} ${className}`.trim()} role="status" aria-busy="true" {...rest}>
      <span className={DOT} />
      <span className={DOT} style={{ animationDelay: '0.2s' }} />
      <span className={DOT} style={{ animationDelay: '0.4s' }} />
    </div>
  );
}
