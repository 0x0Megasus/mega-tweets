import { memo } from "react";

function SetupProfile({
  firebaseUser,
  setupNickname,
  setSetupNickname,
  setupBio,
  setSetupBio,
  setupInterests,
  setSetupInterests,
  interestOptions,
  saveSetup,
  error,
}) {
  const toggleInterest = (value) => {
    setSetupInterests((prev) => (
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    ));
  };

  return (
    <div className="center-screen">
      <div className="setup-card">
        <img src={firebaseUser.photoURL || ""} alt="Google account profile photo" className="avatar-lg" loading="lazy" decoding="async" width={74} height={74} />
        <h2>Complete Profile</h2>
        <input type="text" value={setupNickname} onChange={(e) => setSetupNickname(e.target.value)} placeholder="Your Name Or Nickname.." />
        <textarea value={setupBio} onChange={(e) => setSetupBio(e.target.value)} placeholder="bio" rows={3} />
        <div className="interest-pills">
          {(interestOptions || []).map((interest) => (
            <button
              key={interest}
              type="button"
              className={`interest-pill ${setupInterests.includes(interest) ? "active" : ""}`}
              onClick={() => toggleInterest(interest)}
            >
              {interest}
            </button>
          ))}
        </div>
        <button type="button" className="primary-btn setup-save-btn" onClick={saveSetup}>Save profile</button>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}

export default memo(SetupProfile);
