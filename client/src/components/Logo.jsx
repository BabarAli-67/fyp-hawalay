import logoMarkUrl from '../public/icons/icon.svg?url';

const SIZE_CLASSES = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
  '2xl': 'h-28 w-28',
};

/**
 * Brand mark from `src/public/icons/icon.svg` (bundled via Vite `?url`).
 */
export function Logo({ size = 'xl', className = '', alt = 'Hawalay' }) {
  const box = SIZE_CLASSES[size] ?? SIZE_CLASSES.xl;
  return (
    <img
      src={logoMarkUrl}
      alt={alt}
      className={`object-contain ${box} ${className}`.trim()}
      decoding="async"
    />
  );
}
