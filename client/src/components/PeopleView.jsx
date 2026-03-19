import { memo, useMemo } from "react";
import { FaComments, FaUsers } from "react-icons/fa";

const FALLBACK_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#575b66"/><circle cx="32" cy="24" r="12" fill="#cfd2d8"/><rect x="16" y="40" width="32" height="16" rx="8" fill="#cfd2d8"/></svg>',
)}`;

const pickAvatar = (...values) => values.find((value) => typeof value === "string" && value.trim()) || FALLBACK_AVATAR;

function PeopleView({ users = [], usersLoading = false, usersLoadedOnce = false, profile, onToggleFollow, onOpenProfile, onOpenDm }) {
  const list = useMemo(
    () => users.filter((u) => u.uid && u.uid !== profile?.uid && u.nickname),
    [users, profile?.uid],
  );
  const following = list.filter((u) => u.isFollowing);
  const others = list.filter((u) => !u.isFollowing);

  const renderUser = (u) => (
    <div key={u.uid} className="user-item">
      <button type="button" className="profile-link-btn" onClick={() => onOpenProfile?.(u.uid)}>
        <img src={pickAvatar(u.photoURL, u.photoUrl)} alt={`${u.nickname}'s profile photo`} className="avatar" loading="lazy" decoding="async" width={34} height={34} />
      </button>
      <div className="user-item-body">
        <button type="button" className="profile-link-btn" onClick={() => onOpenProfile?.(u.uid)}>
          <strong>{u.fullName || u.nickname}</strong>
        </button>
        <small>@{u.nickname}</small>
        <small>{u.followerCount || 0} followers • {u.followingCount || 0} following</small>
      </div>
      <div className="user-item-actions">
        <button type="button" className="secondary-btn" onClick={() => onOpenDm?.(u.uid)}>
          <FaComments /> Message
        </button>
        <button type="button" className="primary-btn" onClick={() => onToggleFollow?.(u.uid)}>
          {u.isFollowing ? "Unfollow" : "Follow"}
        </button>
      </div>
    </div>
  );

  return (
    <section className="feed-layout-full">
      <article className="panel">
        <div className="feed-header">
          <h3><FaUsers /> People</h3>
        </div>
        <div className="user-list">
          {usersLoading || !usersLoadedOnce ? (
            <div className="loading-inline">
              <div className="spinner" />
              <p>Loading people...</p>
            </div>
          ) : (
            <>
              {following.length > 0 && <small className="dm-user-group-title">Following</small>}
              {following.map(renderUser)}
              {others.length > 0 && <small className="dm-user-group-title">Discover</small>}
              {others.map(renderUser)}
              {list.length === 0 && <p className="empty-messages">No users yet.</p>}
            </>
          )}
        </div>
      </article>
    </section>
  );
}

export default memo(PeopleView);
