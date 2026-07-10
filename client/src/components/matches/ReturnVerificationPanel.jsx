import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { confirmMatchReturn } from '../../api/matchesService.js';
import { Spinner } from '../ui/Spinner.jsx';

function roleLabel(role) {
  if (role === 'finder') return 'Finder';
  if (role === 'owner') return 'Owner';
  return 'Participant';
}

/**
 * Double-sided return confirmation — Finder "Mark as Returned" / Owner "Mark as Received".
 */
export function ReturnVerificationPanel({
  matchId,
  returnVerification,
  onUpdated,
  compact = false,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [localState, setLocalState] = useState(returnVerification);

  useEffect(() => {
    setLocalState(returnVerification);
  }, [returnVerification]);

  const state = localState ?? returnVerification;
  if (!state || !matchId) return null;

  const {
    userRole,
    userHasConfirmed,
    peerHasConfirmed,
    canConfirm,
    returnCompleted,
    finderConfirmedReturn,
    ownerConfirmedReceive,
  } = state;

  if (!userRole) return null;

  const actionLabel = userRole === 'finder' ? 'Mark as Returned' : 'Mark as Received';
  const confirmedLabel =
    userRole === 'finder' ? 'You marked this as returned' : 'You confirmed receipt';

  async function handleConfirm() {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    try {
      const data = await confirmMatchReturn(matchId);
      setLocalState(data.returnVerification);
      onUpdated?.(data.returnVerification);

      if (data.returnVerification?.returnCompleted) {
        toast.success('Item marked as Returned.');
      } else if (userRole === 'finder') {
        toast.success('Marked as returned. Waiting for the owner to confirm receipt.');
      } else {
        toast.success('Receipt confirmed. Waiting for the finder to mark the return.');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not save confirmation.');
    } finally {
      setSubmitting(false);
    }
  }

  const containerClass = compact
    ? 'rounded-xl border border-outline-variant/25 bg-surface-container-low px-md py-sm space-y-sm'
    : 'rounded-xl border border-outline-variant/25 bg-surface-container-low px-md py-md space-y-sm';

  return (
    <section className={containerClass} aria-label="Return verification">
      <div className="flex items-start gap-sm">
        <span className="material-symbols-outlined text-primary text-[22px] shrink-0">verified_user</span>
        <div className="min-w-0 flex-1 space-y-xs">
          <p className="font-label-sm text-on-surface">Return verification</p>
          <p className="font-caption text-on-surface-variant">
            You are the {roleLabel(userRole).toLowerCase()}. Both parties must confirm before the
            item is marked Returned.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm text-sm">
        <div
          className={`rounded-lg px-sm py-xs font-caption ${
            finderConfirmedReturn
              ? 'bg-primary-container/40 text-on-primary-container'
              : 'bg-surface-container text-on-surface-variant'
          }`}
        >
          <span className="font-label-sm block">Finder</span>
          {finderConfirmedReturn ? 'Handed over' : 'Pending'}
        </div>
        <div
          className={`rounded-lg px-sm py-xs font-caption ${
            ownerConfirmedReceive
              ? 'bg-primary-container/40 text-on-primary-container'
              : 'bg-surface-container text-on-surface-variant'
          }`}
        >
          <span className="font-label-sm block">Owner</span>
          {ownerConfirmedReceive ? 'Received' : 'Pending'}
        </div>
      </div>

      {returnCompleted ? (
        <p className="font-label-sm text-primary flex items-center gap-xs" role="status">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          This item has been marked Returned.
        </p>
      ) : userHasConfirmed ? (
        <p className="font-label-sm text-on-surface-variant" role="status">
          {confirmedLabel}.
          {peerHasConfirmed ? ' The other party has also confirmed.' : ' Waiting for the other party.'}
        </p>
      ) : canConfirm ? (
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="w-full min-h-[44px] rounded-xl bg-primary text-on-primary font-label-sm flex items-center justify-center gap-xs active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px]">
                {userRole === 'finder' ? 'inventory_2' : 'task_alt'}
              </span>
              {actionLabel}
            </>
          )}
        </button>
      ) : null}
    </section>
  );
}
