import { Link } from 'react-router-dom';

export function BillingSuccess() {
  return (
    <div className="support-page">
      <h1>Thank you!</h1>
      <p>Your subscription payment was successful. All features remain free for everyone.</p>
      <Link to="/" className="primary-pill" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>
        Back to map
      </Link>
      <Link to="/support" style={{ display: 'block', marginTop: 16, color: '#007AFF' }}>
        Manage subscription
      </Link>
    </div>
  );
}
