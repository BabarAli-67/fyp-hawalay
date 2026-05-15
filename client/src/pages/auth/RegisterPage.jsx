import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { GoogleAuthButton } from '../../components/auth/GoogleAuthButton.jsx';
import { Button, Spinner } from '../../components/ui/index.js';

const REGISTER_ILLUSTRATION_SRC =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA3EMWVwJ8IlBF6SU8Igyb73RBWp-hT7y_luk0R74ES0fdJZnGoRZoOTaQ2L0sZhJcWWlIpKAOSA3_oYkEzJqbaVeLFmvZcKOvrzlFgTRva4dt6MVMm4yKw-mg0kKy1P2N5Sgjx6D-IU-eFm_M_PC8oR723nHQ-nhNUzqgffyekrAYLXpP9TzhbQLx0sHacAk3eqOJUraNAkqI6okLGWZ4PzToEg6wE_qCajDrc4t10i5iqY6gD3aQXSA77FdzLoXyapgJCkxrlXOg';

function mapValidationErrors(errors) {
  const next = {};
  if (Array.isArray(errors)) {
    for (const item of errors) {
      if (item && item.field) next[item.field] = item.message;
    }
  }
  return next;
}

/**
 * signUp.html — register screen (Stitch markup + controlled fields).
 */
export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [genericError, setGenericError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldErrors({});
    setGenericError(null);

    if (!termsAccepted) {
      setGenericError('Please accept the Terms and Conditions and Privacy Policy to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axiosInstance.post('/api/auth/register', { name, email, password });
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      if (status === 400 && body?.errors) {
        setFieldErrors(mapValidationErrors(body.errors));
      } else if (status === 401 || status === 500) {
        setGenericError(
          typeof body?.error === 'string' ? body.error : 'Something went wrong. Please try again.',
        );
      } else if (status === 409) {
        setGenericError(typeof body?.error === 'string' ? body.error : 'Unable to create account.');
      } else {
        setGenericError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="register-page bg-background font-body-md text-on-background min-h-screen flex flex-col">
      <div className="hidden" aria-hidden>
        <Spinner variant="inline" />
      </div>
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface/70 backdrop-blur-lg shadow-sm">
        <div className="flex items-center gap-base">
          <span className="material-symbols-outlined text-primary" data-icon="shield">
            shield
          </span>
          <h1 className="font-h2 text-h2 font-bold text-primary">EthicalFinder</h1>
        </div>
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-full hover:opacity-80 transition-opacity active:scale-95 transition-transform duration-200"
        >
          <span className="material-symbols-outlined text-on-surface-variant" data-icon="help_outline">
            help_outline
          </span>
        </button>
      </header>
      <main className="flex-grow pt-24 pb-12 px-margin-mobile max-w-lg mx-auto w-full">
        <div className="mb-xl text-center">
          <h2 className="font-h1 text-h1 text-on-surface mb-xs">Join the Community</h2>
          <p className="font-body-md text-on-surface-variant opacity-80">
            Help us return lost belongings to their rightful owners through ethical stewardship.
          </p>
        </div>
        <div
          id="register-error"
          className={`mb-md rounded-lg border border-outline-variant/30 bg-error-container px-md py-sm font-body-md text-on-error-container ${
            genericError ? '' : 'hidden'
          }`}
          role="alert"
        >
          <span className="font-label-sm text-label-sm text-on-error-container">{genericError}</span>
        </div>
        <div className="glass-panel p-lg rounded-xl shadow-lg border border-white/40">
          <form className="space-y-lg" onSubmit={handleSubmit}>
            <div className="relative floating-label-group">
              <input
                className="w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant rounded-t-lg transition-all focus:bg-surface-container focus:border-primary"
                id="full-name"
                placeholder=" "
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <label
                className="absolute left-md top-4 text-on-surface-variant pointer-events-none transition-all duration-200 origin-left"
                htmlFor="full-name"
              >
                Full Name
              </label>
              <p className={`mt-1 font-caption text-error ${fieldErrors.name ? '' : 'hidden'}`} role="status">
                {fieldErrors.name}
              </p>
            </div>
            <div className="relative floating-label-group">
              <input
                className="w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant rounded-t-lg transition-all focus:bg-surface-container focus:border-primary"
                id="email"
                placeholder=" "
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label
                className="absolute left-md top-4 text-on-surface-variant pointer-events-none transition-all duration-200 origin-left"
                htmlFor="email"
              >
                Email Address
              </label>
              <p className={`mt-1 font-caption text-error ${fieldErrors.email ? '' : 'hidden'}`} role="status">
                {fieldErrors.email}
              </p>
            </div>
            <div className="relative floating-label-group">
              <input
                className="w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant rounded-t-lg transition-all focus:bg-surface-container focus:border-primary"
                id="password"
                placeholder=" "
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <label
                className="absolute left-md top-4 text-on-surface-variant pointer-events-none transition-all duration-200 origin-left"
                htmlFor="password"
              >
                Password
              </label>
              <button
                className="absolute right-md top-4 text-outline"
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <span className="material-symbols-outlined" data-icon="visibility">
                  visibility
                </span>
              </button>
              <p className={`mt-1 font-caption text-error ${fieldErrors.password ? '' : 'hidden'}`} role="status">
                {fieldErrors.password}
              </p>
            </div>
            <div className="flex items-start gap-md py-xs">
              <div className="flex items-center h-6">
                <input
                  className="w-5 h-5 text-primary border-outline-variant rounded focus:ring-primary-container"
                  id="terms"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
              </div>
              <label className="font-caption text-caption text-on-surface-variant leading-tight" htmlFor="terms">
                I agree to the{' '}
                <a className="text-primary font-bold" href="#">
                  Terms and Conditions
                </a>{' '}
                and the{' '}
                <a className="text-primary font-bold" href="#">
                  Privacy Policy
                </a>{' '}
                regarding my data stewardship.
              </label>
            </div>
            <Button type="submit" variant="primary" size="lg" loading={submitting}>
              <span>Create Account</span>
            </Button>
            <div className="flex items-center gap-md py-xs">
              <div className="flex-grow h-px bg-outline-variant/30"></div>
              <span className="font-caption text-caption text-outline">OR</span>
              <div className="flex-grow h-px bg-outline-variant/30"></div>
            </div>
            <GoogleAuthButton text="signup_with" />
          </form>
        </div>
        <div className="mt-xl text-center">
          <p className="font-body-md text-on-surface-variant">
            Already have an account?{' '}
            <Link className="text-primary font-bold ml-1 active:opacity-70 transition-opacity" to="/login">
              Log In
            </Link>
          </p>
        </div>
        <div className="mt-xl opacity-20 flex justify-center">
          <img
            alt="Ethical Stewardship"
            className="w-32 h-32 rounded-full object-cover grayscale brightness-110"
            src={REGISTER_ILLUSTRATION_SRC}
          />
        </div>
      </main>
      <footer className="h-20 flex items-center justify-center px-margin-mobile">
        <p className="font-caption text-caption text-outline">© 2024 EthicalFinder Amanat Platform</p>
      </footer>
    </div>
  );
}
