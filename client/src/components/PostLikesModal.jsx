import { memo } from "react";
import { FaTimes, FaUserPlus, FaUserMinus, FaEnvelope, FaUser } from "react-icons/fa";

const FALLBACK_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#575b66"/><circle cx="32" cy="24" r="12" fill="#cfd2d8"/><rect x="16" y="40" width="32" height="16" rx="8" fill="#cfd2d8"/></svg>',
)}`;

const pickAvatar = (...values) => values.find((value) => typeof value === "string" && value.trim()) || FALLBACK_AVATAR;

function PostLikesModal({
  isOpen,
  onClose,
  likes,
  loading,
  profile,
  onToggleFollow,
  onOpenDm,
  onOpenProfile,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content likes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Post likes</h3>
          <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close likes">
            <FaTimes />
          </button>
        </div>
        <div className="likes-modal-body">
          {loading ? (
            <div className="empty-state">
              <div className="loading-inline"><div className="spinner" /><p>Loading likes..</p></div>
            </div>
          ) : (
            <div className="likes-list">
              {!likes.length && <p className="empty-messages">No likes yet.</p>}
              {likes.map((user) => {
                const isMe = user.uid === profile?.uid;
                return (
                  <div key={user.uid} className="like-user-item">
                    <button type="button" className="profile-link-btn" onClick={() => onOpenProfile?.(user.uid)}>
                      <img src={pickAvatar(user.photoURL)} alt={`${user.nickname}'s avatar`} className="avatar-sm" loading="lazy" decoding="async" width={24} height={24} />
                    </button>
                    <div className="like-user-info">
                      <strong>{isMe ? `${user.nickname} (You)` : user.nickname}</strong>
                    </div>
                    <div className="like-user-actions">
                      {!isMe && (
                        <button type="button" className="secondary-btn" onClick={() => onToggleFollow?.(user.uid)}>
                          {user.isFollowing ? <><FaUserMinus /> Unfollow</> : <><FaUserPlus /> Follow</>}
                        </button>
                      )}
                      {!isMe && (
                        <button type="button" className="secondary-btn" onClick={() => onOpenDm?.(user.uid)}>
                          <FaEnvelope /> Message
                        </button>
                      )}
                      <button type="button" className="secondary-btn" onClick={() => onOpenProfile?.(user.uid)}>
                        <FaUser /> Profile
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(PostLikesModal);
