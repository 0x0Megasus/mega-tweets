import { memo } from "react";
import { FaGoogle } from "react-icons/fa";

function AuthLanding({ login, loginLoading, error }) {
  return (
    <div className="landing">
      <div className="landing-card">
        <p className="eyebrow">Mega Tweets</p>
        <h1>Tweet. Reply. Connect.</h1> <br />
        <button type="button" onClick={login} className="primary-btn login-btn" disabled={loginLoading}>
          {loginLoading ? <span className="btn-spinner" /> : null}
          {!loginLoading ? <FaGoogle /> : null}
          <span>{loginLoading ? "Signing in..." : "Continue With Google"}</span>
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}

export default memo(AuthLanding);
