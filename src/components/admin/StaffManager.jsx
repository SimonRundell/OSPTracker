/**
 * StaffManager - CRUD table for staff members (admin only).
 * @module StaffManager
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import * as api from '../../api/api.js';

/**
 * Staff management table with create, edit, deactivate and reset password.
 */
export function StaffManager() {
  const { token } = useAuth();
  const [staff, setStaff]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [tempPass, setTempPass]   = useState(null);
  const [confirmDeact, setConfirmDeact] = useState(null);

  const blankForm = { username:'', email:'', first_name:'', last_name:'', role:'staff' };
  const [form, setForm] = useState(blankForm);

  const loadStaff = useCallback(async () => {
    try {
      const data = await api.getAllStaff(token);
      setStaff(data);
    } catch {
      setError('Could not load staff.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const openCreate = () => { setEditing(null); setForm(blankForm); setTempPass(null); setError(''); setShowForm(true); };
  const openEdit   = (s) => { setEditing(s); setForm({ id: s.id, email: s.email, first_name: s.first_name, last_name: s.last_name, role: s.role, is_active: s.is_active }); setTempPass(null); setError(''); setShowForm(true); };

  /**
   * Submit create or update form.
   * @param {React.FormEvent} e
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api.updateStaff(token, form);
        setShowForm(false);
      } else {
        const result = await api.createStaff(token, form);
        setTempPass(result.temp_password);
        setForm(blankForm);
      }
      loadStaff();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save staff member.');
    }
  };

  /**
   * Reset a staff member's password.
   * @param {number} id
   */
  const handleReset = async (id) => {
    try {
      const result = await api.resetStaffPassword(token, id);
      setTempPass(result.temp_password);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password.');
    }
  };

  /**
   * Deactivate (soft-delete) a staff member.
   * @param {number} id
   */
  const handleDeactivate = async (id) => {
    try {
      await api.deleteStaff(token, id);
      setConfirmDeact(null);
      loadStaff();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not deactivate staff member.');
    }
  };

  if (loading) return <p>Loading staff…</p>;

  return (
    <div>
      <div className="page-header">
        <h3>Staff</h3>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Staff</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {tempPass && (
        <div className="alert alert-success">
          Temporary password: <strong>{tempPass}</strong> — communicate this to the staff member securely.
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id}>
                <td>{s.username}</td>
                <td>{s.first_name} {s.last_name}</td>
                <td>{s.email}</td>
                <td><span className={`badge badge-${s.role}`}>{s.role}</span></td>
                <td><span className={`badge badge-${parseInt(s.is_active) ? 'active' : 'inactive'}`}>{parseInt(s.is_active) ? 'Active' : 'Inactive'}</span></td>
                <td>{s.last_login || '—'}</td>
                <td>
                  <div className="td-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn btn-accent btn-sm" onClick={() => handleReset(s.id)}>Reset PW</button>
                    {parseInt(s.is_active) ? (
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmDeact(s)}>Deactivate</button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>{editing ? 'Edit Staff Member' : 'Add Staff Member'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-danger">{error}</div>}
                {!editing && (
                  <div className="form-group">
                    <label>Username</label>
                    <input type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {editing && (
                  <div className="form-group">
                    <label>Status</label>
                    <select value={form.is_active} onChange={e => setForm({...form, is_active: e.target.value})}>
                      <option value={1}>Active</option>
                      <option value={0}>Inactive</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : 'Create Staff'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeact && (
        <ConfirmDialog
          message={`Deactivate ${confirmDeact.first_name} ${confirmDeact.last_name}? They will no longer be able to log in.`}
          confirmLabel="Deactivate"
          onConfirm={() => handleDeactivate(confirmDeact.id)}
          onCancel={() => setConfirmDeact(null)}
        />
      )}
    </div>
  );
}

export default StaffManager;
