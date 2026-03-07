export default function AuthLanding({ login, loginLoading, error }) {
  return (
    <div className="landing">
      <div className="landing-card">
        <p className="eyebrow">Mega Novels</p>
        <h1>Read. Write. Connect.</h1>
        <button type="button" onClick={login} className="primary-btn login-btn" disabled={loginLoading}>
          {loginLoading ? <span className="btn-spinner" /> : null}
          <span>{loginLoading ? "Signing in..." : "Continue With Google"}</span>
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
