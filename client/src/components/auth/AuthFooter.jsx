import { Link } from 'react-router-dom';

const AUTH_PROMPTS = {
  login: {
    text: "Don't have an account?",
    linkLabel: 'Sign Up',
    linkTo: '/register',
  },
  register: {
    text: 'Already have an account?',
    linkLabel: 'Log In',
    linkTo: '/login',
  },
};

/**
 * Shared footer for login and register — auth switch, legal links, copyright.
 */
export function AuthFooter({ variant = 'login', className = '' }) {
  const { text, linkLabel, linkTo } = AUTH_PROMPTS[variant] ?? AUTH_PROMPTS.login;

  return (
    <footer className={`mt-xl text-center ${className}`.trim()}>
      <p className="font-body-md text-on-surface-variant">
        {text}{' '}
        <Link className="font-label-sm text-primary font-bold hover:underline" to={linkTo}>
          {linkLabel}
        </Link>
      </p>
      <div className="mt-lg flex items-center justify-center gap-lg">
        <a className="font-caption text-on-surface-variant hover:text-primary transition-colors" href="#">
          Privacy Policy
        </a>
        <span className="w-1 h-1 rounded-full bg-outline-variant" aria-hidden />
        <a className="font-caption text-on-surface-variant hover:text-primary transition-colors" href="#">
          Terms of Service
        </a>
      </div>
      <p className="mt-lg font-caption text-caption text-outline">© 2026 Hawalay | AI-Powered Recovery</p>
    </footer>
  );
}
