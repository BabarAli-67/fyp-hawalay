import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import axiosInstance from '../../api/axiosInstance.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { mapValidationErrors } from '../../utils/mapValidationErrors.js';
import { Button } from '../ui/Button.jsx';
import { ProfileModal } from './ProfileModal.jsx';

export function EditProfileModal({ user, onClose }) {
  const { updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setBio(user?.bio ?? '');
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldErrors({});
    setSubmitting(true);

    try {
      const { data } = await axiosInstance.patch('/api/users/profile', {
        name: name.trim(),
        email: email.trim(),
        bio: bio.trim(),
      });
      updateUser(data.user);
      toast.success('Profile updated');
      onClose();
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      if (status === 400 && body?.errors) {
        setFieldErrors(mapValidationErrors(body.errors));
      } else {
        toast.error(body?.error || 'Could not update profile');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const emailHint =
    user?.authProvider === 'local' && email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase()
      ? 'Changing your email will require verification again.'
      : null;

  return (
    <ProfileModal
      title="Edit profile"
      onClose={onClose}
      footer={
        <Button type="submit" form="edit-profile-form" loading={submitting} disabled={submitting}>
          Save changes
        </Button>
      }
    >
      <form id="edit-profile-form" className="space-y-lg" onSubmit={handleSubmit}>
        <div className="relative floating-label-group">
          <input
            id="profile-name"
            className="w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant rounded-t-lg transition-all focus:bg-surface-container focus:border-primary"
            placeholder=" "
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
          />
          <label
            className="absolute left-md top-4 text-on-surface-variant pointer-events-none transition-all duration-200 origin-left"
            htmlFor="profile-name"
          >
            Full name
          </label>
          {fieldErrors.name ? (
            <p className="mt-1 font-caption text-error" role="alert">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>

        <div className="relative floating-label-group">
          <input
            id="profile-email"
            className="w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant rounded-t-lg transition-all focus:bg-surface-container focus:border-primary"
            placeholder=" "
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          <label
            className="absolute left-md top-4 text-on-surface-variant pointer-events-none transition-all duration-200 origin-left"
            htmlFor="profile-email"
          >
            Email
          </label>
          {fieldErrors.email ? (
            <p className="mt-1 font-caption text-error" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
          {emailHint ? (
            <p className="mt-1 font-caption text-on-surface-variant">{emailHint}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="profile-bio" className="font-label-sm text-label-sm text-on-surface-variant block mb-xs">
            Bio <span className="text-outline">(optional)</span>
          </label>
          <textarea
            id="profile-bio"
            className="w-full min-h-[100px] px-md py-sm bg-surface-container-low border border-outline-variant rounded-lg focus:border-primary focus:bg-surface-container transition-colors resize-y"
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            aria-invalid={Boolean(fieldErrors.bio)}
          />
          <p className="mt-1 font-caption text-on-surface-variant text-right">{bio.length}/500</p>
          {fieldErrors.bio ? (
            <p className="mt-1 font-caption text-error" role="alert">
              {fieldErrors.bio}
            </p>
          ) : null}
        </div>
      </form>
    </ProfileModal>
  );
}
