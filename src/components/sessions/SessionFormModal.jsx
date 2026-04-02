/**
 * SessionFormModal - modal form to create a new session.
 * @module SessionFormModal
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import * as api from '../../api/api.js';

/**
 * @param {{ projectId: number, onClose: Function, onCreated: Function }} props
 */
export function SessionFormModal({ projectId, onClose, onCreated }) {
  const { token, user } = useAuth();
  const [allStaff, setAllStaff]   = useState([]);
  const [students, setStudents]   = useState([]);
  const [form, setForm] = useState({
    session_date: '',
    start_time: '',
    end_time: '',
    supervisor_id: user?.sub || '',
    session_type: 'class',
    student_project_id: '',
    notes: '',
  });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [staffData, studentData] = await Promise.all([
        api.getAllStaff(token),
        api.getStudentsForProject(token, projectId),
      ]);
      setAllStaff(staffData.filter(s => parseInt(s.is_active)));
      setStudents(studentData);
      // Default supervisor to current user
      if (!form.supervisor_id && staffData.length > 0) {
        setForm(f => ({ ...f, supervisor_id: f.supervisor_id || staffData[0].id }));
      }
    };
    load().catch(() => setError('Could not load form data.'));
  }, [token, projectId]);

  /**
   * Update a form field.
   * @param {string} field
   * @param {*} value
   */
  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  /**
   * Submit the session creation form.
   * @param {React.FormEvent} e
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.session_date || !form.start_time || !form.end_time || !form.supervisor_id) {
      setError('Date, start time, end time, and supervisor are required.');
      return;
    }
    if (form.start_time >= form.end_time) {
      setError('Start time must be before end time.');
      return;
    }
    if (form.session_type === 'individual' && !form.student_project_id) {
      setError('Please select a student for individual sessions.');
      return;
    }
    setSaving(true);
    try {
      await api.createSession(token, {
        project_id: projectId,
        session_date: form.session_date,
        start_time: form.start_time,
        end_time: form.end_time,
        supervisor_id: parseInt(form.supervisor_id),
        session_type: form.session_type,
        student_project_id: form.session_type === 'individual' ? parseInt(form.student_project_id) : null,
        notes: form.notes,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create session.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3>Add Session</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="sess-date">Date</label>
                <input id="sess-date" type="date" value={form.session_date} onChange={e => set('session_date', e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="sess-type">Type</label>
                <select id="sess-type" value={form.session_type} onChange={e => set('session_type', e.target.value)}>
                  <option value="class">Class</option>
                  <option value="individual">Individual</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="sess-start">Start Time</label>
                <input id="sess-start" type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="sess-end">End Time</label>
                <input id="sess-end" type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="sess-supervisor">Supervisor</label>
              <select id="sess-supervisor" value={form.supervisor_id} onChange={e => set('supervisor_id', e.target.value)} required>
                <option value="">— Select —</option>
                {allStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                ))}
              </select>
            </div>
            {form.session_type === 'individual' && (
              <div className="form-group">
                <label htmlFor="sess-student">Student</label>
                <select id="sess-student" value={form.student_project_id} onChange={e => set('student_project_id', e.target.value)} required>
                  <option value="">— Select student —</option>
                  {students.map(s => (
                    <option key={s.project_student_id} value={s.project_student_id}>
                      {s.surname}, {s.first_name} ({s.candidate_number})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="sess-notes">Notes (optional)</label>
              <textarea id="sess-notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SessionFormModal;
