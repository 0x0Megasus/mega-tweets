import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="center-screen">
      <div className="notfound-card">
        <p className="eyebrow">404</p>
        <h1>Page Not Found</h1>
        <p>The page you requested does not exist.</p>
        <Link to="/feed" className="primary-btn notfound-link">Go To Feed</Link>
      </div>
    </div>
  );
}
