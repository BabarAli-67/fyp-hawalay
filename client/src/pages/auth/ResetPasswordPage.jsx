import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance.js';
import { AuthFooter } from '../../components/auth/AuthFooter.jsx';
import { Button, Logo, Spinner } from '../../components/ui/index.js';

function mapValidationErrors(errors) {
  const next = {};
  if (Array.isArray(errors)) {
    for (const item of errors) {
      if (item && item.field) next[item.field] = item.message;
    }
  }
  return next;
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialState = location.state ?? {};

  const [email, setEmail] = useState(initialState.email ?? '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [genericError, setGenericError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(initialState.message ?? null);
  const [expiresInMinutes, setExpiresInMinutes] = useState(initialState.expiresInMinutes ?? 10);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password', { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const clearAlerts = useCallback(() => {
    setFieldErrors({});
    setGenericError(null);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    clearAlerts();

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axiosInstance.post('/api/auth/password-reset/verify', {
        email,
        otp: otp.trim(),
        password,
        confirmPassword,
      });
      setSuccessMessage(data.message || 'Password updated successfully.');
      setResetComplete(true);
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      if (status === 400 && body?.errors) {
        setFieldErrors(mapValidationErrors(body.errors));
      } else if (status === 400 || status === 429) {
        setGenericError(body?.error || 'Could not reset password.');
        if (body?.code === 'OTP_EXPIRED' || body?.code === 'OTP_ATTEMPTS_EXCEEDED') {
          navigate('/forgot-password', { replace: true });
        }
      } else {
        setGenericError(body?.error || 'Could not reset password. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending) return;
    clearAlerts();
    setResending(true);
    try {
      const { data } = await axiosInstance.post('/api/auth/password-reset/resend-otp', { email });
      setSuccessMessage(data.message || 'A new code has been sent.');
      setExpiresInMinutes(data.expiresInMinutes ?? 10);
      setResendCooldown(data.retryAfterSeconds ?? 60);
      setOtp('');
    } catch (err) {
      const body = err?.response?.data;
      const status = err?.response?.status;
      if (status === 429 && body?.retryAfterSeconds) {
        setResendCooldown(body.retryAfterSeconds);
      }
      setGenericError(body?.error || 'Could not resend code.');
    } finally {
      setResending(false);
    }
  }

  if (!email) {
    return null;
  }

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen flex flex-col">
      <div className="hidden" aria-hidden>
        <Spinner variant="inline" />
      </div>
      <main className="relative z-10 flex-grow flex flex-col items-center justify-center px-margin-mobile py-xl">
        <header className="w-full max-w-md text-center mb-xl">
          <div className="inline-flex items-center justify-center p-md bg-surface-container-lowest rounded-xl shadow-sm mb-lg border border-outline-variant/30">
            <Logo size="xl" />
          </div>
          <h1 className="font-h1 text-h1 text-on-surface mb-xs">
            {resetComplete ? 'Password Updated' : 'Reset Password'}
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-sm mx-auto">
            {resetComplete
              ? 'Your password has been changed. You can now sign in.'
              : `Enter the code sent to ${email}. Code expires in ${expiresInMinutes} minutes.`}
          </p>
        </header>

        {genericError ? (
          <div
            className="mb-md w-full max-w-md rounded-lg border border-outline-variant/30 bg-error-container px-md py-sm"
            role="alert"
          >
            <span className="font-label-sm text-on-error-container">{genericError}</span>
          </div>
        ) : null}

        {successMessage && !resetComplete ? (
          <div
            className="mb-md w-full max-w-md rounded-lg border border-outline-variant/30 bg-primary-container px-md py-sm"
            role="status"
          >
            <span className="font-label-sm text-on-primary-container">{successMessage}</span>
          </div>
        ) : null}

        <div className="w-full max-w-md glass-panel p-xl rounded-xl shadow-lg border border-white/50">
          {resetComplete ? (
            <div className="space-y-lg text-center">
              <p className="font-body-md text-on-surface-variant">{successMessage}</p>
              <Button type="button" variant="primary" size="md" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          ) : (
            <form className="space-y-lg" onSubmit={handleSubmit}>
              <div className="relative floating-label-container group">
                <input
                  className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant focus:ring-0 focus:border-primary px-xs pt-lg pb-xs font-body-md text-on-surface transition-soft text-center tracking-[0.4em]"
                  id="otp"
                  placeholder=" "
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <label
                  className="absolute left-xs top-md font-label-sm text-on-surface-variant transition-soft pointer-events-none origin-left"
                  htmlFor="otp"
                >
                  Reset Code
                </label>
                <p className={`mt-1 font-caption text-error ${fieldErrors.otp ? '' : 'hidden'}`} role="status">
                  {fieldErrors.otp}
                </p>
              </div>
              <div className="relative floating-label-container group">
                <input
                  className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant focus:ring-0 focus:border-primary px-xs pt-lg pb-xs font-body-md text-on-surface transition-soft"
                  id="password"
                  placeholder=" "
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <label
                  className="absolute left-xs top-md font-label-sm text-on-surface-variant transition-soft pointer-events-none origin-left"
                  htmlFor="password"
                >
                  New Password
                </label>
                <button
                  className="absolute right-xs bottom-base text-on-surface-variant hover:text-primary transition-colors"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined text-[20px]">visibility</span>
                </button>
                <p className={`mt-1 font-caption text-error ${fieldErrors.password ? '' : 'hidden'}`} role="status">
                  {fieldErrors.password}
                </p>
              </div>
              <div className="relative floating-label-container group">
                <input
                  className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant focus:ring-0 focus:border-primary px-xs pt-lg pb-xs font-body-md text-on-surface transition-soft"
                  id="confirm-password"
                  placeholder=" "
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <label
                  className="absolute left-xs top-md font-label-sm text-on-surface-variant transition-soft pointer-events-none origin-left"
                  htmlFor="confirm-password"
                >
                  Confirm Password
                </label>
                <button
                  className="absolute right-xs bottom-base text-on-surface-variant hover:text-primary transition-colors"
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined text-[20px]">visibility</span>
                </button>
                <p
                  className={`mt-1 font-caption text-error ${fieldErrors.confirmPassword ? '' : 'hidden'}`}
                  role="status"
                >
                  {fieldErrors.confirmPassword}
                </p>
              </div>
              <Button type="submit" variant="primary" size="md" loading={submitting}>
                Update Password
              </Button>
              <div className="flex flex-col items-center gap-sm">
                <button
                  type="button"
                  className="font-label-sm text-primary font-bold disabled:opacity-50"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resending}
                >
                  {resending
                    ? 'Sending…'
                    : resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : 'Resend reset code'}
                </button>
                <Link className="font-caption text-on-surface-variant hover:text-primary" to="/forgot-password">
                  Use a different email
                </Link>
              </div>
            </form>
          )}
        </div>
        <AuthFooter variant="login" className="w-full max-w-md" />
      </main>
    </div>
  );
}

