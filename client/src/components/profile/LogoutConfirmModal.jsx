import { Button } from '../ui/Button.jsx';
import { ProfileModal } from './ProfileModal.jsx';

/**
 * Confirms logout before clearing the session (Navbar logout button).
 */
export function LogoutConfirmModal({ onConfirm, onCancel }) {
  return (
    <ProfileModal
      title="Logout"
      onClose={onCancel}
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-sm">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Logout
          </Button>
        </div>
      }
    >
      <p className="font-body-md text-on-surface">Are you sure you want to log out?</p>
      <p className="font-body-md text-on-surface-variant mt-sm">
        You will need to sign in again to continue.
      </p>
    </ProfileModal>
  );
}
