import { useState } from 'react';
import { toast } from 'react-toastify';
import axiosInstance from '../../api/axiosInstance.js';
import { mapValidationErrors } from '../../utils/mapValidationErrors.js';
import {
  validateNewPassword,
  validatePasswordMatch,
} from '../../utils/passwordValidation.js';
import { Button } from '../ui/Button.jsx';
import { ProfileModal } from './ProfileModal.jsx';

export function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldErrors({});

    const clientErrors = {};
    const newErr = validateNewPassword(newPassword);
    if (newErr) clientErrors.newPassword = newErr;
    const matchErr = validatePasswordMatch(newPassword, confirmPassword);
    if (matchErr) clientErrors.confirmPassword = matchErr;
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axiosInstance.patch('/api/users/password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      toast.success(data.message || 'Password updated successfully');
      onClose();
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      if (status === 400 && body?.errors) {
        setFieldErrors(mapValidationErrors(body.errors));
      } else {
        toast.error(body?.error || 'Could not change password');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function renderPasswordField({
    id,
    label,
    value,
    onChange,
    show,
    onToggleShow,
    errorKey,
    autoComplete,
  }) {
    return (
      <div className="relative floating-label-container group">
        <input
          id={id}
          className="w-full h-14 pt-4 px-md pr-12 bg-surface-container-low border-b-2 border-outline-variant rounded-t-lg transition-all focus:bg-surface-container focus:border-primary"
          placeholder=" "
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(fieldErrors[errorKey])}
        />
        <label
          className="absolute left-md top-4 text-on-surface-variant pointer-events-none transition-all duration-200 origin-left"
          htmlFor={id}
        >
          {label}
        </label>
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-on-surface-variant"
          onClick={onToggleShow}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <span className="material-symbols-outlined text-[20px]">
            {show ? 'visibility_off' : 'visibility'}
          </span>
        </button>
        {fieldErrors[errorKey] ? (
          <p className="mt-1 font-caption text-error" role="alert">
            {fieldErrors[errorKey]}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <ProfileModal
      title="Change password"
      onClose={onClose}
      footer={
        <Button type="submit" form="change-password-form" loading={submitting} disabled={submitting}>
          Update password
        </Button>
      }
    >
      <form id="change-password-form" className="space-y-lg" onSubmit={handleSubmit}>
        {renderPasswordField({
          id: 'current-password',
          label: 'Current password',
          value: currentPassword,
          onChange: (e) => setCurrentPassword(e.target.value),
          show: showCurrent,
          onToggleShow: () => setShowCurrent((s) => !s),
          errorKey: 'currentPassword',
          autoComplete: 'current-password',
        })}
        {renderPasswordField({
          id: 'new-password',
          label: 'New password',
          value: newPassword,
          onChange: (e) => setNewPassword(e.target.value),
          show: showNew,
          onToggleShow: () => setShowNew((s) => !s),
          errorKey: 'newPassword',
          autoComplete: 'new-password',
        })}
        {renderPasswordField({
          id: 'confirm-password',
          label: 'Confirm new password',
          value: confirmPassword,
          onChange: (e) => setConfirmPassword(e.target.value),
          show: showConfirm,
          onToggleShow: () => setShowConfirm((s) => !s),
          errorKey: 'confirmPassword',
          autoComplete: 'new-password',
        })}
        <p className="font-caption text-on-surface-variant">
          Use at least 8 characters with uppercase, lowercase, and a number.
        </p>
      </form>
    </ProfileModal>
  );
}
