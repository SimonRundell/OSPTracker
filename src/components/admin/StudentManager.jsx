/**
 * StudentManager - CRUD table for students (admin only).
 * @module StudentManager
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import * as api from '../../api/api.js';

/**
 * Student management table with create, edit and deactivate.
 */
export function StudentManager() {
  const { token } = useAuth();
  const [students, setStudents]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [confirmDeact, setConfirmDeact] = useState(null);

  const blankForm = { candidate_number: '', cis_ref: '', surname: '', first_name: '' };
  const [form, setForm] = useState(blankForm);

  const loadStudents = useCallback(async () => {
    try {
      const data = await api.getAllStudents(token);
      setStudents(data);
    } catch {
      setError('Could not load students.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const openCreate = () => { setEditing(null); setForm(blankForm); setError(''); setShowForm(true); };
  const openEdit   = (s) => { setEditing(s); setForm({ id: s.id, candidate_number: s.candidate_number, cis_ref: s.cis_ref || '', surname: s.surname, first_name: s.first_name }); setError(''); setShowForm(true); };

  /**
   * Validate and submit create/update.
   * @param {React.FormEvent} e
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.candidate_number || form.candidate_number.length > 30) {
      setError('Candidate number is required and must be 30 characters or fewer.');
      return;
    }
    try {
      if (editing) {
        await api.updateStudent(token, form);
      } else {
        await api.createStudent(token, form);
      }
      setShowForm(false);
      loadStudents();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save student.');
    }
  };

  /**
   * Deactivate a student record.
   * @param {number} id
   */
  const handleDeactivate = async (id) => {
    try {
      await api.deactivateStudent(token, id);
      setConfirmDeact(null);
      loadStudents();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not deactivate student.');
    }
  };

  if (loading) return <p>Loading students…</p>;

  return (
    <div>
      <div className="page-header">
        <h3>Students</h3>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Student</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Candidate #</th>
              <th>CIS Ref</th>
              <th>Surname</th>
              <th>First Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id}>
                <td>{s.candidate_number}</td>
                <td>{s.cis_ref || '—'}</td>
                <td>{s.surname}</td>
                <td>{s.first_name}</td>
                <td><span className={`badge badge-${parseInt(s.is_active) ? 'active' : 'inactive'}`}>{parseInt(s.is_active) ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div className="td-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>Edit</button>
                    {parseInt(s.is_active) && (
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmDeact(s)}>Deactivate</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted">No students found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>{editing ? 'Edit Student' : 'Add Student'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-danger">{error}</div>}
                <div className="form-group">
                  <label>Candidate Number <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    value={form.candidate_number}
                    onChange={e => setForm({...form, candidate_number: e.target.value})}
                    maxLength={30}
                    required
                    placeholder="e.g. LL-000020681"
                  />
                  <small className="form-hint">Required. Max 30 characters.</small>
                </div>
                <div className="form-group">
                  <label>CIS Reference (optional)</label>
                  <input type="text" value={form.cis_ref} onChange={e => setForm({...form, cis_ref: e.target.value})} placeholder="e.g. 9900596081" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Surname <span className="text-danger">*</span></label>
                    <input type="text" value={form.surname} onChange={e => setForm({...form, surname: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>First Name <span className="text-danger">*</span></label>
                    <input type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : 'Create Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeact && (
        <ConfirmDialog
          message={`Deactivate ${confirmDeact.first_name} ${confirmDeact.last_name}? They will be removed from student lists.`}
          confirmLabel="Deactivate"
          onConfirm={() => handleDeactivate(confirmDeact.id)}
          onCancel={() => setConfirmDeact(null)}
        />
      )}
    </div>
  );
}

export default StudentManager;
