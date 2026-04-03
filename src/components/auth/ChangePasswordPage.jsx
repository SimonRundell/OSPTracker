/**
 * ChangePasswordPage - forced and voluntary password change.
 * @module ChangePasswordPage
 */
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import * as api from '../../api/api.js';

/**
 * Password change form. Enforced on first login (must_change_password).
 */
export function ChangePasswordPage() {
  const { token, user, logoutUser } = useAuth();
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);

  // console.log('Rendering ChangePasswordPage', { user });

  /**
   * Validate the new password locally.
   * @returns {string|null} Error message or null if valid.
   */
  const validate = () => {
    if (next.length < 8)      return 'New password must be at least 8 characters.';
    if (!/[A-Z]/.test(next))  return 'New password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(next))  return 'New password must contain at least one digit.';
    if (next !== confirm)     return 'Passwords do not match.';
    return null;
  };

  /**
   * Handle form submission.
   * @param {React.FormEvent} e
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError('');
    setLoading(true);
    try {
      await api.changePassword(token, current, next);
      setSuccess('Password changed successfully. You will be logged out.');
      setTimeout(() => logoutUser(), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Change Password</h1>
        {user?.must_change_password === 1 && (
          <div className="alert alert-accent auth-subtitle">You must set a new password before continuing.</div>
        )}
        <form onSubmit={handleSubmit} className="auth-form">
          {error   && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          <div className="form-group">
            <label htmlFor="current">Current Password</label>
            <input id="current" type="password" value={current} onChange={e => setCurrent(e.target.value)} required autoComplete="current-password" />
          </div>
          <div className="form-group">
            <label htmlFor="new-pass">New Password</label>
            <input id="new-pass" type="password" value={next} onChange={e => setNext(e.target.value)} required autoComplete="new-password" />
            <small className="form-hint">Min 8 characters, one uppercase letter, one digit.</small>
          </div>
          <div className="form-group">
            <label htmlFor="confirm">Confirm New Password</label>
            <input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangePasswordPage;
