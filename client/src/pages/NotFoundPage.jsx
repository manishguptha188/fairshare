import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <main className="page">
      <div className="state state-empty">
        <p className="state-title">Page not found</p>
        <Link to="/groups">Go to your groups</Link>
      </div>
    </main>
  );
}
