import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance.js';
import { getApiErrorMessage } from '../../utils/apiErrors.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Spinner } from '../ui/Spinner.jsx';

/**
 * App-owned Google OAuth button. The account chooser opens in Google's popup,
 * avoiding the embedded GIS suggestion card overlapping the registration form.
 */
export function GoogleAuthButton({ text = 'signin_with' }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const buttonLabel = text === 'signup_with' ? 'Sign up with Google' : 'Sign in with Google';

  const startGoogle = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      if (!token) {
        setError('No token received from Google.');
        setIsBusy(false);
        return;
      }

      setError(null);
      try {
        const { data } = await axiosInstance.post('/api/auth/google', { token });
        login(data.token, data.user);
        navigate('/dashboard');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Unable to sign in with Google.'));
      } finally {
        setIsBusy(false);
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled or failed.');
      setIsBusy(false);
    },
    onNonOAuthError: () => {
      setIsBusy(false);
    },
  });

  if (!clientId) {
    return (
      <p className="text-caption text-on-surface-variant text-center">
        Google sign-in is not configured. Set <code className="font-mono text-xs">VITE_GOOGLE_CLIENT_ID</code> in{' '}
        <code className="font-mono text-xs">client/.env</code>.
      </p>
    );
  }

  return (
    <div className="w-full flex flex-col items-stretch gap-sm">
      {error ? (
        <p className="text-caption text-error text-center" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          if (isBusy) return;
          setIsBusy(true);
          setError(null);
          startGoogle();
        }}
        disabled={isBusy}
        aria-busy={isBusy}
        className="w-full h-12 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface shadow-sm flex items-center justify-center gap-md font-label-sm transition-all hover:bg-surface-container-low active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
      >
        {isBusy ? (
          <Spinner variant="inline" />
        ) : (
          <>
            <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.39 13.93A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.32.32-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.55l3.35-2.62Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
              />
            </svg>
            <span>{buttonLabel}</span>
          </>
        )}
      </button>
    </div>
  );
}
