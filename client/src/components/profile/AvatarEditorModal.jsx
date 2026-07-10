import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import axiosInstance from '../../api/axiosInstance.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { UserAvatar } from '../UserAvatar.jsx';
import { Button } from '../ui/Button.jsx';
import { ProfileModal } from './ProfileModal.jsx';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_BYTES = 5 * 1024 * 1024;

export function AvatarEditorModal({ user, onClose }) {
  const { updateUser } = useAuth();
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      toast.warn('Only JPEG and PNG images are allowed');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.warn('Image must be 5 MB or smaller');
      return;
    }

    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!selectedFile) {
      toast.info('Choose an image first');
      return;
    }

    const formData = new FormData();
    formData.append('image', selectedFile);
    setSubmitting(true);
    try {
      const { data } = await axiosInstance.patch('/api/users/avatar', formData);
      updateUser(data.user);
      toast.success('Profile photo updated');
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not upload photo');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const { data } = await axiosInstance.patch('/api/users/avatar', { remove: true });
      updateUser(data.user);
      toast.success('Profile photo removed');
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not remove photo');
    } finally {
      setRemoving(false);
    }
  }

  const previewUser = previewUrl
    ? { ...user, avatarUrl: previewUrl }
    : user;

  const hasExistingAvatar = Boolean(user?.avatarUrl);

  return (
    <ProfileModal
      title="Profile photo"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-sm">
          <Button loading={submitting} disabled={submitting || !selectedFile} onClick={handleSave}>
            Save photo
          </Button>
          {hasExistingAvatar ? (
            <Button
              variant="secondary"
              loading={removing}
              disabled={removing || submitting}
              onClick={handleRemove}
            >
              Remove photo
            </Button>
          ) : null}
        </div>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        onChange={handleFileChange}
      />
      <div className="flex flex-col items-center gap-md">
        <UserAvatar user={previewUser} size="lg" className="border-4 border-surface-container-lowest shadow-lg" />
        <p className="font-body-md text-on-surface-variant text-center">
          JPEG or PNG, up to 5 MB. Your photo is stored securely on your account.
        </p>
        <Button variant="secondary" type="button" onClick={openPicker} disabled={submitting || removing}>
          {selectedFile ? 'Choose a different photo' : 'Choose photo'}
        </Button>
      </div>
    </ProfileModal>
  );
}
