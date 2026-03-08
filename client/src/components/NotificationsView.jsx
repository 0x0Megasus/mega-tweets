import { FaBell } from "react-icons/fa";

export default function NotificationsView({ notifications, notifText, timeAgo, markRead }) {
  return (
    <section className="grid-two">
      <article className="panel">
        <h3><FaBell /> Notifications</h3>
        <div className="cards">
          {notifications.length === 0 ? (
            <div className="empty-state">
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`novel-card ${n.read ? "" : "notif-unread"}`}>
                <p>{notifText(n)}</p>
                <small>{timeAgo(n.createdAt)}</small>
                {!n.read && (
                  <div className="actions-row">
                    <button type="button" onClick={() => markRead(n.id)}>
                      Mark Read
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
