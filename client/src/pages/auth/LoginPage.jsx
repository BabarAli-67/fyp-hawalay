import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import axiosInstance from '../../api/axiosInstance.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button, Spinner } from '../../components/ui/index.js';

/** login.html — Google logo asset */
const GOOGLE_LOGO_SRC =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB_519AzeoAiZYZDhxIO-FAJXS1ZqU2zZ2VWIypJWzuQgsqi3Uyb52aMwtHwQx6pNurQcunBj7IYmnTKy1ffiZXpUz6ek2Mga9vt8ubRMflgIlAFh3ozONQBu_04XwZROJg55EwaswMpxIfSpYtbrxdXz8E79d8RAb9WzooUOxRlCRyHFOwyQGOFxg9B6FBdQracUfobCT6kdaRtJd8WgE1qOcFOOpTxLos4qEN3s57oWvGx09qngeVW84ZeFTCOyUGK52CV6McG-c';

const ILLUSTRATION_SRC =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBU8LCt-h_Yrv1ShpchljwJvMFTHSFMaxMeBphyoqvu4Q-C2OwKMX5XQmf1E6QCzy8MxdG6l_JxFMgu-q5pI_jzNWfnUs9Zy-7S8bASL6y1t7KsjWjTdRFE5cRKNVP1COMywYNUHq2iCWfiA7f-inl3LTzS-Qpe6f8k-ZQmRw3d-dtCz3CQAs7413aoqZJDVevvmhKqcAAE-ggXfh8wtsnf6DtpKJp-PGYcEfvECvhrwZyQCTkSFR6vbBT3NdmbZYlRfXnjcRdbg-M';

const STITCH_GOOGLE_BTN =
  'w-full bg-surface-container-lowest border border-outline-variant text-on-surface h-12 rounded-lg font-label-sm shadow-sm active:scale-95 transition-soft flex items-center justify-center gap-md';

/**
 * login.html — social Google button (Stitch styling + useGoogleLogin).
 * `useGoogleLogin` returns an access token; server accepts JWT or access token in `token`.
 */
function GoogleLoginButton() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState(null);

  const startGoogle = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      const accessToken = tokenResponse.access_token;
      if (!accessToken) {
        setGoogleError('No token from Google.');
        setGoogleBusy(false);
        return;
      }
      setGoogleError(null);
      try {
        const { data } = await axiosInstance.post('/api/auth/google', { token: accessToken });
        login(data.token, data.user);
        navigate('/dashboard');
      } catch (err) {
        const msg = err?.response?.data?.error || err?.message || 'Unable to sign in with Google.';
        setGoogleError(typeof msg === 'string' ? msg : 'Unable to sign in with Google.');
      } finally {
        setGoogleBusy(false);
      }
    },
    onError: () => {
      setGoogleError('Google sign-in was cancelled or failed.');
      setGoogleBusy(false);
    },
    onNonOAuthError: () => {
      setGoogleBusy(false);
    },
  });

  return (
    <div className="w-full space-y-sm">
      {googleError ? (
        <p className="font-caption text-error text-center" role="alert">
          {googleError}
        </p>
      ) : null}
      <button
        type="button"
        className={STITCH_GOOGLE_BTN}
        onClick={() => {
          if (googleBusy) return;
          setGoogleBusy(true);
          setGoogleError(null);
          startGoogle();
        }}
        disabled={googleBusy}
        aria-busy={googleBusy}
      >
        {googleBusy ? (
          <Spinner variant="inline" />
        ) : (
          <>
            <img alt="Google Logo" className="w-5 h-5" src={GOOGLE_LOGO_SRC} />
            Sign in with Google
          </>
        )}
      </button>
    </div>
  );
}

function GoogleLoginPlaceholder() {
  return (
    <button type="button" className={STITCH_GOOGLE_BTN} disabled>
      <img alt="Google Logo" className="w-5 h-5" src={GOOGLE_LOGO_SRC} />
      Sign in with Google
    </button>
  );
}

/**
 * login.html — transactional login screen (Stitch markup + controlled fields).
 */
function mapValidationErrors(errors) {
  const next = {};
  if (Array.isArray(errors)) {
    for (const item of errors) {
      if (item && item.field) next[item.field] = item.message;
    }
  }
  return next;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [genericError, setGenericError] = useState(null);

  const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldErrors({});
    setGenericError(null);
    setSubmitting(true);
    try {
      const { data } = await axiosInstance.post('/api/auth/login', { email, password });
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
      } else {
        setGenericError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page bg-surface font-body-md text-on-surface selection:bg-primary-container selection:text-on-primary-container">
      <div className="hidden" aria-hidden>
        <Spinner variant="inline" />
      </div>
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary-fixed-dim/20 blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-secondary-fixed/20 blur-[100px]"></div>
      </div>
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-margin-mobile py-xl">
        <header className="w-full max-w-md text-center mb-xl">
          <div className="inline-flex items-center justify-center p-md bg-surface-container-lowest rounded-xl shadow-sm mb-lg border border-outline-variant/30">
            <span
              className="material-symbols-outlined text-[48px] text-primary"
              data-icon="shield_with_heart"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              shield_with_heart
            </span>
          </div>
          <h1 className="font-h1 text-h1 text-on-surface mb-xs">EthicalFinder</h1>
          <p className="font-body-md text-on-surface-variant max-w-xs mx-auto">
            Providing peace of mind through community stewardship and integrity.
          </p>
        </header>
        <div
          id="login-error"
          className={`mb-md w-full max-w-md rounded-lg border border-outline-variant/30 bg-error-container px-md py-sm font-body-md text-on-error-container ${
            genericError ? '' : 'hidden'
          }`}
          role="alert"
        >
          <span className="font-label-sm text-label-sm text-on-error-container">{genericError}</span>
        </div>
        <div className="w-full max-w-md glass-panel p-xl rounded-xl shadow-lg border border-white/50">
          <form className="space-y-lg" onSubmit={handleSubmit}>
            <div className="relative floating-label-container group">
              <input
                className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant focus:ring-0 focus:border-primary px-xs pt-lg pb-xs font-body-md text-on-surface transition-soft"
                id="email"
                placeholder=" "
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label
                className="absolute left-xs top-md font-label-sm text-on-surface-variant transition-soft pointer-events-none origin-left"
                htmlFor="email"
              >
                Email Address
              </label>
              <p
                className={`mt-1 font-caption text-error ${fieldErrors.email ? '' : 'hidden'}`}
                role="status"
              >
                {fieldErrors.email}
              </p>
            </div>
            <div className="relative floating-label-container group">
              <input
                className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant focus:ring-0 focus:border-primary px-xs pt-lg pb-xs font-body-md text-on-surface transition-soft"
                id="password"
                placeholder=" "
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <label
                className="absolute left-xs top-md font-label-sm text-on-surface-variant transition-soft pointer-events-none origin-left"
                htmlFor="password"
              >
                Password
              </label>
              <div className="absolute right-xs bottom-base">
                <button
                  className="text-on-surface-variant hover:text-primary transition-colors"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined text-[20px]" data-icon="visibility">
                    visibility
                  </span>
                </button>
              </div>
              <p
                className={`mt-1 font-caption text-error ${fieldErrors.password ? '' : 'hidden'}`}
                role="status"
              >
                {fieldErrors.password}
              </p>
            </div>
            <div className="flex justify-end">
              <a className="font-label-sm text-primary hover:opacity-80 transition-soft" href="#">
                Forgot Password?
              </a>
            </div>
            <Button type="submit" variant="primary" size="md" loading={submitting}>
              Login
              <span className="material-symbols-outlined text-[18px]" data-icon="arrow_forward">
                arrow_forward
              </span>
            </Button>
            <div className="flex items-center gap-md py-md">
              <div className="h-[1px] bg-outline-variant/50 flex-grow"></div>
              <span className="font-caption text-on-surface-variant">OR</span>
              <div className="h-[1px] bg-outline-variant/50 flex-grow"></div>
            </div>
            {googleConfigured ? <GoogleLoginButton /> : <GoogleLoginPlaceholder />}
          </form>
        </div>
        <footer className="mt-xl text-center">
          <p className="font-body-md text-on-surface-variant">
            Don&apos;t have an account?{' '}
            <Link className="font-label-sm text-primary font-bold hover:underline" to="/register">
              Sign Up
            </Link>
          </p>
          <div className="mt-lg flex items-center justify-center gap-lg">
            <a className="font-caption text-on-surface-variant hover:text-primary transition-colors" href="#">
              Privacy Policy
            </a>
            <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
            <a className="font-caption text-on-surface-variant hover:text-primary transition-colors" href="#">
              Terms of Service
            </a>
          </div>
        </footer>
        <div className="mt-xl opacity-20 pointer-events-none">
          <img
            alt=""
            className="w-64 h-auto rounded-full mix-blend-multiply"
            src={ILLUSTRATION_SRC}
          />
        </div>
      </main>
    </div>
  );
}
