import { FaBell, FaComments, FaFeatherAlt, FaHashtag, FaUser, FaUsers, FaUserFriends } from "react-icons/fa";

export default function TopNav({ tabs, tab, setTab, profile, firebaseUser, badgeCounts = {} }) {
  const tabMeta = {
    feed: { label: "Tweets", icon: <FaHashtag /> },
    groups: { label: "Groups", icon: <FaUsers /> },
    dm: { label: "Direct", icon: <FaComments /> },
    notifications: { label: "Notifications", icon: <FaBell /> },
    people: { label: "People", icon: <FaUserFriends /> },
    profile: { label: "Profile", icon: <FaUser /> },
  };

  return (
    <nav className="top-nav">
      <div className="brand"><FaFeatherAlt /><span>Mega Tweets</span></div>
      <div className="tab-row">
        {tabs.map((t) => (
          <button type="button" key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {tabMeta[t]?.icon}
            <span>{tabMeta[t]?.label || t}</span>
            {Number(badgeCounts[t] || 0) > 0 && <em className="tab-badge">{badgeCounts[t]}</em>}
          </button>
        ))}
      </div>
      <div className="user-pill">
        <img src={profile.photoURL || firebaseUser.photoURL || ""} alt={profile.nickname} className="avatar" />
        <span>{profile.nickname}</span>
      </div>
    </nav>
  );
}
