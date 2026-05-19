import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { AuthFooter } from '../../components/auth/AuthFooter.jsx';
import { GoogleAuthButton } from '../../components/auth/GoogleAuthButton.jsx';
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

/**
 * Registration with email OTP verification before account creation.
 */
export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [genericError, setGenericError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [expiresInMinutes, setExpiresInMinutes] = useState(10);
  const [resendCooldown, setResendCooldown] = useState(0);

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
    setSuccessMessage(null);
  }, []);

  async function handleSendOtp(e) {
    e.preventDefault();
    clearAlerts();

    if (!termsAccepted) {
      setGenericError('Please accept the Terms and Conditions and Privacy Policy to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axiosInstance.post('/api/auth/register/send-otp', {
        name,
        email,
        password,
      });
      setSuccessMessage(data.message || 'Verification code sent. Check your email.');
      setExpiresInMinutes(data.expiresInMinutes ?? 10);
      setResendCooldown(60);
      setOtp('');
      setStep('verify');
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      if (status === 400 && body?.errors) {
        setFieldErrors(mapValidationErrors(body.errors));
      } else if (status === 409) {
        setGenericError(typeof body?.error === 'string' ? body.error : 'Email already registered.');
      } else if (status === 503) {
        setGenericError(body?.error || 'Email service is unavailable. Please try again later.');
      } else {
        setGenericError(body?.error || 'Could not send verification code. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    clearAlerts();

    if (!/^\d{6}$/.test(otp.trim())) {
      setFieldErrors({ otp: 'Enter the 6-digit code from your email.' });
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axiosInstance.post('/api/auth/register/verify-otp', {
        email,
        otp: otp.trim(),
      });
      setSuccessMessage(data.message || 'Account created successfully.');
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      if (status === 400 && body?.errors) {
        setFieldErrors(mapValidationErrors(body.errors));
      } else if (status === 400 || status === 429) {
        setGenericError(body?.error || 'Verification failed.');
        if (body?.code === 'OTP_EXPIRED' || body?.code === 'OTP_ATTEMPTS_EXCEEDED') {
          setStep('details');
          setOtp('');
        }
      } else if (status === 409) {
        setGenericError(body?.error || 'Email already registered.');
      } else {
        setGenericError(body?.error || 'Verification failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || resending) return;
    clearAlerts();
    setResending(true);
    try {
      const { data } = await axiosInstance.post('/api/auth/register/resend-otp', { email });
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
      setGenericError(body?.error || 'Could not resend code. Please try again.');
    } finally {
      setResending(false);
    }
  }

  function handleBackToDetails() {
    clearAlerts();
    setStep('details');
    setOtp('');
  }

  return (
    <div className="register-page bg-background font-body-md text-on-background min-h-screen flex flex-col">
      <div className="hidden" aria-hidden>
        <Spinner variant="inline" />
      </div>
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface/70 backdrop-blur-lg shadow-sm">
        <div className="flex items-center gap-base">
          <Logo size="sm" />
          <h1 className="font-h2 text-h2 font-bold text-primary">Hawalay</h1>
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
          <div className="inline-flex items-center justify-center p-md bg-surface-container-lowest rounded-xl shadow-sm mb-lg border border-outline-variant/30">
            <Logo size="xl" />
          </div>
          <h2 className="font-h1 text-h1 text-on-surface mb-xs">
            {step === 'details' ? 'Start Your Recovery Journey.' : 'Verify Your Email'}
          </h2>
          <p className="font-body-md text-on-surface-variant opacity-80">
            {step === 'details'
              ? 'Experience AI-driven lost and found. Our system uses advanced image recognition and OCR to match your belongings with 99% accuracy.'
              : `Enter the 6-digit code sent to ${email}. It expires in ${expiresInMinutes} minutes.`}
          </p>
        </div>

        {genericError ? (
          <div
            id="register-error"
            className="mb-md rounded-lg border border-outline-variant/30 bg-error-container px-md py-sm font-body-md text-on-error-container"
            role="alert"
          >
            <span className="font-label-sm text-label-sm text-on-error-container">{genericError}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div
            className="mb-md rounded-lg border border-outline-variant/30 bg-primary-container px-md py-sm font-body-md text-on-primary-container"
            role="status"
          >
            <span className="font-label-sm text-label-sm">{successMessage}</span>
          </div>
        ) : null}

        <div className="glass-panel p-lg rounded-xl shadow-lg border border-white/40">
          {step === 'details' ? (
            <form className="space-y-lg" onSubmit={handleSendOtp}>
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
                <span>Send Verification Code</span>
              </Button>
              <div className="flex items-center gap-md py-xs">
                <div className="flex-grow h-px bg-outline-variant/30" />
                <span className="font-caption text-caption text-outline">OR</span>
                <div className="flex-grow h-px bg-outline-variant/30" />
              </div>
              <GoogleAuthButton text="signup_with" />
            </form>
          ) : (
            <form className="space-y-lg" onSubmit={handleVerifyOtp}>
              <div className="relative floating-label-group">
                <input
                  className="w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant rounded-t-lg transition-all focus:bg-surface-container focus:border-primary text-center tracking-[0.4em] font-label-lg"
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
                  className="absolute left-md top-4 text-on-surface-variant pointer-events-none transition-all duration-200 origin-left"
                  htmlFor="otp"
                >
                  Verification Code
                </label>
                <p className={`mt-1 font-caption text-error ${fieldErrors.otp ? '' : 'hidden'}`} role="status">
                  {fieldErrors.otp}
                </p>
              </div>
              <Button type="submit" variant="primary" size="lg" loading={submitting}>
                <span>Verify &amp; Create Account</span>
              </Button>
              <div className="flex flex-col items-center gap-sm">
                <button
                  type="button"
                  className="font-label-sm text-primary font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || resending}
                >
                  {resending
                    ? 'Sending…'
                    : resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : 'Resend verification code'}
                </button>
                <button
                  type="button"
                  className="font-caption text-on-surface-variant hover:text-primary transition-colors"
                  onClick={handleBackToDetails}
                >
                  Change email or details
                </button>
              </div>
            </form>
          )}
        </div>
        <AuthFooter variant="register" />
      </main>
    </div>
  );
}


