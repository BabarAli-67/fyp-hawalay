import { motion } from 'framer-motion';
import { Logo } from '../Logo.jsx';

const SPINNER_BORDER = 'border-[3px] border-white/30 border-t-white rounded-full animate-spin';

/**
 * Full-screen splash / preloader (framer-motion).
 */
export function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-primary"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          duration: 0.6,
          ease: 'easeOut',
        }}
      >
        <Logo size="2xl" className="mb-4 block" />
      </motion.div>

      <motion.h1
        className="font-h1 text-h1 font-bold text-white mb-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        HAWALAY
      </motion.h1>

      <motion.p
        className="text-white/80 text-sm font-body-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        Lost &amp; Found Recovery
      </motion.p>

      <motion.div
        className="absolute bottom-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        <div className={`h-8 w-8 ${SPINNER_BORDER}`} />
      </motion.div>
    </motion.div>
  );
}
