import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [genericError, setGenericError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldErrors({});
    setGenericError(null);
    setSubmitting(true);

    try {
      const { data } = await axiosInstance.post('/api/auth/password-reset/request', { email });
      navigate('/reset-password', {
        replace: true,
        state: {
          email,
          message: data.message,
          expiresInMinutes: data.expiresInMinutes ?? 10,
        },
      });
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      if (status === 400 && body?.errors) {
        setFieldErrors(mapValidationErrors(body.errors));
      } else if (status === 404) {
        setGenericError(body?.error || 'No account is registered with this email address.');
      } else if (status === 503) {
        setGenericError(body?.error || 'Email service is unavailable. Please try again later.');
      } else {
        setGenericError(body?.error || 'Could not process your request. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
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
          <h1 className="font-h1 text-h1 text-on-surface mb-xs">Forgot Password</h1>
          <p className="font-body-md text-on-surface-variant max-w-sm mx-auto">
            Enter your registered email and we&apos;ll send you a 6-digit code to reset your password.
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
              <p className={`mt-1 font-caption text-error ${fieldErrors.email ? '' : 'hidden'}`} role="status">
                {fieldErrors.email}
              </p>
            </div>
            <Button type="submit" variant="primary" size="md" loading={submitting}>
              Send Reset Code
            </Button>
            <p className="text-center">
              <Link className="font-label-sm text-primary font-bold hover:underline" to="/login">
                Back to Login
              </Link>
            </p>
          </form>
        </div>
        <AuthFooter variant="login" className="w-full max-w-md" />
      </main>
    </div>
  );
}

