export default function ProfileView({
  profile,
  firebaseUser,
  profileDraft,
  setProfileDraft,
  saveProfile,
  soundSettings,
  setSoundSettings,
}) {
  return (
    <section className="grid-two">
      <article className="panel sticky">
        <h3>My Profile</h3>
        <div className="profile-box">
          <img
            src={profile.photoURL || firebaseUser.photoURL || ""}
            alt={profile.nickname}
            className="avatar-lg"
          />
          <p><strong>{profile.fullName}</strong></p>
          <p>@{profile.nickname}</p>
          <p>{profile.bio || "No bio"}</p>
        </div>
      </article>

      <article className="panel">
        <h3>Edit</h3>
        <form className="stack-form profile-edit-form" onSubmit={saveProfile}>
          <input
            value={profileDraft.nickname}
            onChange={(e) => setProfileDraft((p) => ({ ...p, nickname: e.target.value }))}
            placeholder="Your Name Or Nickname.."
            minLength={2}
            required
          />
          <textarea
            rows={4}
            value={profileDraft.bio}
            onChange={(e) => setProfileDraft((p) => ({ ...p, bio: e.target.value }))}
            placeholder="bio"
          />
          <button type="submit" className="primary-btn">
            Update
          </button>
        </form>
        <div className="sound-settings-box">
          <h4>Sound Settings</h4>
          <label className="sound-toggle">
            <input
              type="checkbox"
              checked={Boolean(soundSettings?.notifications)}
              onChange={(e) => setSoundSettings((prev) => ({ ...prev, notifications: e.target.checked }))}
            />
            Notification sound
          </label>
          <label className="sound-toggle">
            <input
              type="checkbox"
              checked={Boolean(soundSettings?.dm)}
              onChange={(e) => setSoundSettings((prev) => ({ ...prev, dm: e.target.checked }))}
            />
            DM message sound
          </label>
          <label className="sound-toggle">
            <input
              type="checkbox"
              checked={Boolean(soundSettings?.groups)}
              onChange={(e) => setSoundSettings((prev) => ({ ...prev, groups: e.target.checked }))}
            />
            Group message sound
          </label>
        </div>
      </article>
    </section>
  );
}
