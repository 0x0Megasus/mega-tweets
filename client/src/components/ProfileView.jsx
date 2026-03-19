import { memo } from "react";

function ProfileView({
  profile,
  firebaseUser,
  profileDraft,
  setProfileDraft,
  saveProfile,
  soundSettings,
  setSoundSettings,
  theme,
  setTheme,
  onLogout,
  interestOptions = [],
}) {
  const onPickAvatar = (file) => {
    if (!file) return;
    if (file.size > 1_000_000) {
      window.alert("Profile photo is too large. Max size is 1MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = typeof reader.result === "string" ? reader.result : "";
      if (!data) return;
      setProfileDraft((p) => ({ ...p, photoURL: data }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="grid-two">
      <article className="panel sticky">
        <h3>My Profile</h3>
        <div className="profile-box">
          <img
            src={profileDraft.photoURL || profile.photoURL || firebaseUser.photoURL || ""}
            alt={`${profile.nickname}'s profile photo`}
            className="avatar-lg"
            loading="lazy"
            decoding="async"
            width={74}
            height={74}
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
            type="file"
            accept="image/*"
            onChange={(e) => onPickAvatar(e.target.files?.[0])}
          />
          {profileDraft.photoURL && (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setProfileDraft((p) => ({ ...p, photoURL: profile.photoURL || firebaseUser.photoURL || "" }))}
            >
              Reset selected photo
            </button>
          )}
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
          <div className="interest-pills">
            {interestOptions.map((interest) => (
              <button
                key={interest}
                type="button"
                className={`interest-pill ${(profileDraft.interests || []).includes(interest) ? "active" : ""}`}
                onClick={() => setProfileDraft((prev) => {
                  const current = prev.interests || [];
                  const interests = current.includes(interest)
                    ? current.filter((item) => item !== interest)
                    : [...current, interest];
                  return { ...prev, interests };
                })}
              >
                {interest}
              </button>
            ))}
          </div>
          <button type="submit" className="primary-btn">
            Update
          </button>
          <button type="button" className="secondary-btn" onClick={onLogout}>
            Logout
          </button>
        </form>
        <div className="sound-settings-box">
          <h4>Appearance</h4>
          <label className="sound-toggle">
            <input
              type="checkbox"
              checked={theme === "light"}
              onChange={(e) => setTheme(e.target.checked ? "light" : "dark")}
            />
            Light mode
          </label>
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

export default memo(ProfileView);
