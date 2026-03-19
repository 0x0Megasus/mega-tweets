import { memo } from "react";
import { FaBell } from "react-icons/fa";

const FALLBACK_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#575b66"/><circle cx="32" cy="24" r="12" fill="#cfd2d8"/><rect x="16" y="40" width="32" height="16" rx="8" fill="#cfd2d8"/></svg>',
)}`;

function NotificationsView({ notifications, notifText, timeAgo, openNotification, clearNotifications, notificationOpeningId = "" }) {
  return (
    <section className="feed-layout-full">
      <article className="panel">
        <div className="feed-header">
          <h3><FaBell /> Notifications</h3>
          <button
            type="button"
            className="secondary-btn"
            onClick={clearNotifications}
            disabled={!notifications.length}
          >
            Clear All
          </button>
        </div>
        <div className="notif-list">
          {notifications.length === 0 ? (
            <div className="empty-state">
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                type="button"
                key={n.id}
                className={`notif-item ${n.read ? "" : "notif-unread"}`}
                onClick={() => openNotification(n)}
              >
                <img
                  src={n.actorPhotoURL || FALLBACK_AVATAR}
                  alt={n.actorNickname || "User"}
                  className="avatar"
                  loading="lazy"
                  decoding="async"
                  width={34}
                  height={34}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = FALLBACK_AVATAR;
                  }}
                />
                <div className="notif-content">
                  <p>{notifText(n)}</p>
                  <small>{timeAgo(n.createdAt)}</small>
                </div>
                {notificationOpeningId === n.id && <span className="btn-spinner" />}
              </button>
            ))
          )}
        </div>
      </article>
    </section>
  );
}

export default memo(NotificationsView);
