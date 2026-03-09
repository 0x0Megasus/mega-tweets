export default function SetupProfile({ firebaseUser, setupNickname, setSetupNickname, setupBio, setSetupBio, saveSetup, error }) {
  return (
    <div className="center-screen">
      <div className="setup-card">
        <img src={firebaseUser.photoURL || ""} alt="Google profile" className="avatar-lg" />
        <h2>Complete Profile</h2>
        <input type="text" value={setupNickname} onChange={(e) => setSetupNickname(e.target.value)} placeholder="Your Name Or Nickname.." />
        <textarea value={setupBio} onChange={(e) => setSetupBio(e.target.value)} placeholder="bio" rows={3} />
        <button type="button" className="primary-btn setup-save-btn" onClick={saveSetup}>Save profile</button>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
