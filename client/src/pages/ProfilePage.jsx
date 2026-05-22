import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance.js';
import { AvatarEditorModal } from '../components/profile/AvatarEditorModal.jsx';
import { ChangePasswordModal } from '../components/profile/ChangePasswordModal.jsx';
import { EditProfileModal } from '../components/profile/EditProfileModal.jsx';
import { SettingsRow } from '../components/profile/SettingsRow.jsx';
import { UserAvatar } from '../components/UserAvatar.jsx';
import { ItemCard } from '../components/items/ItemCard.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatMemberSince } from '../utils/formatMemberSince.js';
import { computeProfileStats, mapItemForCard } from '../utils/mapItemForCard.js';

/**
 * user_profle.html â€” profile hero + sections (authenticated user from AuthContext).
 * Top navbar and bottom tab bar are provided by AppLayout.
 */
export default function ProfilePage() {
  const { user: authUser, isAuthLoading } = useAuth();
  const outletContext = useOutletContext() ?? {};
  const user = authUser ?? outletContext.user;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('reports');
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const ownerId = user?._id ?? user?.id;

  const fetchItems = useCallback(async () => {
    if (!ownerId) {
      setItems([]);
      setItemsLoading(false);
      return;
    }

    setItemsLoading(true);
    try {
      const { data } = await axiosInstance.get('/api/items', {
        params: { ownerId, page: 1, limit: 50 },
      });
      setItems((data.items ?? []).map(mapItemForCard));
    } catch {
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (!isAuthLoading && user) {
      fetchItems();
    }
  }, [fetchItems, isAuthLoading, user]);

  async function handleStatusChange(item, status) {
    try {
      await axiosInstance.patch(`/api/items/${item._id}/status`, { status });
      await fetchItems();
    } catch {
      // Keep list unchanged on failure.
    }
  }

  const stats = computeProfileStats(items);

  function renderHero() {
    if (isAuthLoading) {
      return (
        <section className="flex flex-col items-center text-center py-xl" aria-busy="true">
          <Spinner />
          <p className="font-body-md text-on-surface-variant mt-md">Loading your profileâ€¦</p>
        </section>
      );
    }

    if (!user) {
      return (
        <section className="flex flex-col items-center text-center py-lg">
          <EmptyState
            icon="person_off"
            title="Profile unavailable"
            subtitle="Sign in again to view your profile."
            actionLabel="Go to login"
            onAction={() => navigate('/login')}
          />
        </section>
      );
    }

    const displayName = user.name?.trim() || 'Hawalay member';
    const email = user.email?.trim() || '';
    const bio = user.bio?.trim() || '';

    return (
      <section className="flex flex-col items-center text-center">
        <div className="relative mb-md">
          <button
            type="button"
            onClick={() => setModal('avatar')}
            className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Change profile photo"
          >
            <UserAvatar user={user} size="lg" className="border-4 border-white shadow-lg" />
            <span className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md border-2 border-white">
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            </span>
          </button>
          {user.isVerified ? (
            <div
              className="absolute -bottom-2 right-2 bg-primary text-on-primary text-[10px] font-bold px-3 py-1 rounded-full border-2 border-white shadow-sm flex items-center gap-1"
              aria-label="Verified member"
            >
              <span
                className="material-symbols-outlined text-[12px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              TRUSTED
            </div>
          ) : null}
        </div>
        <h1 className="font-h1 text-h1 text-on-surface">{displayName}</h1>
        {email ? (
          <p className="font-body-md text-on-surface-variant mt-xs break-all max-w-full px-sm">{email}</p>
        ) : null}
        {bio ? (
          <p className="font-body-md text-on-surface mt-sm max-w-md px-sm">{bio}</p>
        ) : null}
        <p className="text-on-surface-variant font-body-md mt-xs">{formatMemberSince(user.createdAt)}</p>
        <button
          type="button"
          onClick={() => setModal('edit')}
          className="mt-md px-md py-sm rounded-full border border-outline-variant text-primary font-label-sm hover:bg-primary/5 transition-colors"
        >
          Edit profile
        </button>
        {!user.isVerified ? (
          <p className="font-caption text-on-surface-variant mt-sm px-md">
            Email verification pending â€” complete registration to earn trusted status.
          </p>
        ) : null}
      </section>
    );
  }

  const showMainSections = !isAuthLoading && user;

  return (
    <div className="bg-background text-on-background min-h-screen">
      <div className="px-margin-mobile space-y-lg max-w-2xl mx-auto">
        <section className="mt-4">
          <h2 className="font-h1 text-h1 text-on-surface">Profile</h2>
          <p className="font-body-md text-on-surface-variant">Your account, reports, and preferences.</p>
        </section>

        {renderHero()}

        {showMainSections ? (
          <>
            <section className="grid grid-cols-3 gap-3" aria-label="Report statistics">
              <div className="bg-surface-container-low p-md rounded-xl text-center shadow-sm border-b-4 border-transparent">
                <p className="font-h2 text-h2 text-primary font-bold">
                  {itemsLoading ? 'â€”' : stats.lost}
                </p>
                <p className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Lost</p>
              </div>
              <div className="bg-primary-container/10 p-md rounded-xl text-center shadow-sm border-b-4 border-primary">
                <p className="font-h2 text-h2 text-primary font-bold">
                  {itemsLoading ? 'â€”' : stats.found}
                </p>
                <p className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Found</p>
              </div>
              <div className="bg-surface-container-low p-md rounded-xl text-center shadow-sm border-b-4 border-transparent">
                <p className="font-h2 text-h2 text-primary font-bold">
                  {itemsLoading ? 'â€”' : stats.returns}
                </p>
                <p className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Returns</p>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-xl border-b border-outline-variant/30 mb-md">
                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className={`pb-base border-b-2 font-h3 text-h3 transition-colors ${
                    activeTab === 'reports'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant'
                  }`}
                >
                  My Reports
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('matches')}
                  className={`pb-base border-b-2 font-h3 text-h3 transition-colors ${
                    activeTab === 'matches'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant'
                  }`}
                >
                  Match History
                </button>
              </div>

              {activeTab === 'reports' ? (
                itemsLoading ? (
                  <div className="flex justify-center py-xl">
                    <Spinner />
                  </div>
                ) : items.length === 0 ? (
                  <EmptyState
                    icon="inventory_2"
                    title="No reports on your profile yet"
                    subtitle="Your lost and found reports will appear here once you submit them."
                    actionLabel="Report an item"
                    onAction={() => navigate('/report')}
                    className="py-lg"
                  />
                ) : (
                  <div className="space-y-md pb-8">
                    {items.map((item) => (
                      <ItemCard key={item._id} item={item} onStatusChange={handleStatusChange} />
                    ))}
                  </div>
                )
              ) : (
                <EmptyState
                  icon="auto_awesome"
                  title="No match history yet"
                  subtitle="When our matching service finds candidates for your reports, they will show up here."
                  actionLabel="View matches"
                  onAction={() => navigate('/matches')}
                  className="py-lg"
                />
              )}
            </section>

            <section className="pb-8">
              <h2 className="font-h3 text-h3 text-on-surface-variant mb-md px-1">Settings &amp; Security</h2>
              <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
                <SettingsRow icon="edit" label="Edit profile" onClick={() => setModal('edit')} />
                <div className="h-[1px] bg-outline-variant/20 mx-md" />
                <SettingsRow icon="photo_camera" label="Profile photo" onClick={() => setModal('avatar')} />
                {user.authProvider === 'local' ? (
                  <>
                    <div className="h-[1px] bg-outline-variant/20 mx-md" />
                    <SettingsRow icon="lock" label="Change password" onClick={() => setModal('password')} />
                  </>
                ) : null}
                <div className="h-[1px] bg-outline-variant/20 mx-md" />
                <SettingsRow icon="notifications" label="Notifications" to="/notifications" />
                <div className="h-[1px] bg-outline-variant/20 mx-md" />
                <SettingsRow icon="shield" label="Privacy" disabled />
                <div className="h-[1px] bg-outline-variant/20 mx-md" />
                <SettingsRow icon="help" label="Help & Support" disabled />
              </div>
            </section>
          </>
        ) : null}
      </div>

      {modal === 'edit' ? <EditProfileModal user={user} onClose={() => setModal(null)} /> : null}
      {modal === 'avatar' ? <AvatarEditorModal user={user} onClose={() => setModal(null)} /> : null}
      {modal === 'password' ? <ChangePasswordModal onClose={() => setModal(null)} /> : null}
    </div>
  );
}
