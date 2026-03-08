import { FaUserCircle } from "react-icons/fa";

export default function ProfileView({ profile, firebaseUser, profileDraft, setProfileDraft, saveProfile }) {
  return (
    <section className="grid-two">
      <article className="panel sticky">
        <h3><FaUserCircle /> Profile</h3>
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
        <form className="stack-form" onSubmit={saveProfile}>
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
      </article>
    </section>
  );
}
