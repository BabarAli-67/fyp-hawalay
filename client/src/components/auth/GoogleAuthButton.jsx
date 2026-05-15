import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Sends Google ID token to POST /api/auth/google as `{ token }` (matches server).
 */
export function GoogleAuthButton({ text = 'signin_with' }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
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
      <div className="w-full flex justify-center overflow-hidden rounded-lg min-h-[48px] [&>div]:!w-full [&_iframe]:!w-full">
        <GoogleLogin
          onSuccess={async (credentialResponse) => {
            const token = credentialResponse.credential;
            if (!token) return;
            setError(null);
            try {
              const { data } = await axiosInstance.post('/api/auth/google', { token });
              login(data.token, data.user);
              navigate('/dashboard');
            } catch (err) {
              const msg =
                err?.response?.data?.error || err?.message || 'Unable to sign in with Google.';
              setError(typeof msg === 'string' ? msg : 'Unable to sign in with Google.');
            }
          }}
          onError={() => setError('Google sign-in was cancelled or failed.')}
          useOneTap={false}
          theme="outline"
          size="large"
          text={text}
          shape="rectangular"
          width="100%"
        />
      </div>
    </div>
  );
}
