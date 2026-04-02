/**
 * EnrolStudentsModal - modal to enrol a student onto a project.
 * @module EnrolStudentsModal
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import * as api from '../../api/api.js';

/**
 * @param {{ projectId: number, onClose: Function, onEnrolled: Function }} props
 */
export function EnrolStudentsModal({ projectId, onClose, onEnrolled }) {
  const { token } = useAuth();
  const [allStudents, setAllStudents]   = useState([]);
  const [enrolled, setEnrolled]         = useState([]);
  const [selectedId, setSelectedId]     = useState('');
  const [extension, setExtension]       = useState(0);
  const [restBreaks, setRestBreaks]     = useState(false);
  const [notes, setNotes]               = useState('');
  const [error, setError]               = useState('');
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    const load = async () => {
      const [all, enrolledData] = await Promise.all([
        api.getAllStudents(token),
        api.getStudentsForProject(token, projectId),
      ]);
      setAllStudents(all);
      setEnrolled(enrolledData.map(s => s.student_id));
    };
    load().catch(() => setError('Could not load students.'));
  }, [token, projectId]);

  const available = allStudents.filter(s => !enrolled.includes(parseInt(s.id)));

  /**
   * Submit enrolment.
   * @param {React.FormEvent} e
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedId) { setError('Please select a student.'); return; }
    if (![0,10,20,25].includes(parseInt(extension))) { setError('Extension must be 0, 10, 20, or 25.'); return; }
    setError('');
    setSaving(true);
    try {
      await api.enrolStudent(token, {
        project_id: projectId,
        student_id: parseInt(selectedId),
        time_extension_percent: parseInt(extension),
        rest_breaks: restBreaks ? 1 : 0,
        notes,
      });
      onEnrolled();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not enrol student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3>Enrol Student</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label htmlFor="enrol-student">Student</label>
              <select id="enrol-student" value={selectedId} onChange={e => setSelectedId(e.target.value)} required>
                <option value="">— Select student —</option>
                {available.map(s => (
                  <option key={s.id} value={s.id}>{s.surname}, {s.first_name} ({s.candidate_number})</option>
                ))}
              </select>
              {available.length === 0 && <small className="form-hint">All active students are already enrolled.</small>}
            </div>
            <div className="form-group">
              <label htmlFor="enrol-ext">Time Extension</label>
              <select id="enrol-ext" value={extension} onChange={e => setExtension(e.target.value)}>
                <option value={0}>None (0%)</option>
                <option value={10}>10% extra time</option>
                <option value={20}>20% extra time</option>
                <option value={25}>25% extra time</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                <input type="checkbox" checked={restBreaks} onChange={e => setRestBreaks(e.target.checked)} />
                {' '}Rest breaks
              </label>
            </div>
            <div className="form-group">
              <label htmlFor="enrol-notes">Notes (optional)</label>
              <textarea id="enrol-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enrolling…' : 'Enrol Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EnrolStudentsModal;
