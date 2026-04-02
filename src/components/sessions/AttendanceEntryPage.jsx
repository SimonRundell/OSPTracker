/**
 * AttendanceEntryPage - enter/edit minutes_present per student for a session.
 * @module AttendanceEntryPage
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingSpinner } from '../shared/LoadingSpinner.jsx';
import * as api from '../../api/api.js';

/**
 * Attendance entry form for a single session.
 */
export function AttendanceEntryPage() {
  const { id, sessionId } = useParams();
  const { token } = useAuth();
  const [sessionData, setSessionData] = useState(null);
  const [students, setStudents]       = useState([]);
  const [values, setValues]           = useState({});
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  const loadData = useCallback(async () => {
    try {
      const data = await api.getAttendanceForSession(token, sessionId);
      setSessionData(data.session);
      setStudents(data.students);
      const initVals = {};
      data.students.forEach(s => {
        initVals[s.project_student_id] = String(s.minutes_present ?? 0);
      });
      setValues(initVals);
    } catch {
      setError('Could not load attendance data.');
    } finally {
      setLoading(false);
    }
  }, [token, sessionId]);

  useEffect(() => { loadData(); }, [loadData]);

  /**
   * Parse a time input: accepts "HH:MM" or plain integer minutes.
   * @param {string} val
   * @returns {number} Minutes as integer
   */
  const parseMinutes = (val) => {
    const str = String(val).trim();
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    const parts = str.split(':');
    if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    return 0;
  };

  /**
   * Handle input change for a student's minutes.
   * @param {number} psId - project_student_id
   * @param {string} val
   */
  const handleChange = (psId, val) => {
    setValues(v => ({ ...v, [psId]: val }));
    setSuccess('');
  };

  /**
   * Save all attendance records.
   * @param {React.FormEvent} e
   */
  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const attendance = students.map(s => ({
        project_student_id: s.project_student_id,
        minutes_present: parseMinutes(values[s.project_student_id] ?? 0),
      }));
      await api.saveSessionAttendance(token, parseInt(sessionId), attendance);
      setSuccess('Attendance saved successfully.');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save attendance.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Format HH:MM:SS → HH:MM.
   * @param {string} t
   * @returns {string}
   */
  const fmt = (t) => (t || '').substring(0, 5);

  if (loading) return <LoadingSpinner />;
  if (!sessionData) return <div className="page-container"><div className="alert alert-danger">{error}</div></div>;

  const availMins = Math.round(
    (new Date(`1970-01-01T${sessionData.end_time}`) - new Date(`1970-01-01T${sessionData.start_time}`)) / 60000
  );

  return (
    <div className="page-container">
      <div className="breadcrumb">
        <Link to="/projects">Projects</Link><span>›</span>
        <Link to={`/projects/${id}/sessions`}>Sessions</Link><span>›</span>Attendance
      </div>

      <div className="page-header">
        <h2>Attendance Entry</h2>
      </div>

      <div className="session-info-panel">
        <div className="session-info-item">
          <span className="session-info-label">Date</span>
          <span className="session-info-value">{sessionData.session_date}</span>
        </div>
        <div className="session-info-item">
          <span className="session-info-label">Time</span>
          <span className="session-info-value">{fmt(sessionData.start_time)} – {fmt(sessionData.end_time)}</span>
        </div>
        <div className="session-info-item">
          <span className="session-info-label">Available</span>
          <span className="session-info-value">{availMins} mins</span>
        </div>
        <div className="session-info-item">
          <span className="session-info-label">Type</span>
          <span className="session-info-value" style={{textTransform:'capitalize'}}>{sessionData.session_type}</span>
        </div>
      </div>

      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSave}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Candidate #</th>
                <th>Name</th>
                <th>Allowed (mins)</th>
                <th>Used to date</th>
                <th>Remaining</th>
                <th>Mins This Session</th>
                <th>Warnings</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const entered = parseMinutes(values[s.project_student_id] ?? 0);
                const usedBefore = parseInt(s.total_minutes_used) - parseInt(s.minutes_present);
                const wouldTotal = usedBefore + entered;
                const overSession = entered > availMins;
                const overAllowed = wouldTotal > parseInt(s.total_minutes_allowed);
                return (
                  <tr key={s.project_student_id}>
                    <td>{s.candidate_number}</td>
                    <td>{s.surname}, {s.first_name}</td>
                    <td>{s.total_minutes_allowed}</td>
                    <td>{usedBefore}</td>
                    <td className={s.minutes_remaining < 0 ? 'text-danger' : ''}>{s.minutes_remaining}</td>
                    <td>
                      <input
                        type="text"
                        className="minutes-input"
                        value={values[s.project_student_id] ?? '0'}
                        onChange={e => handleChange(s.project_student_id, e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td>
                      {overSession && (
                        <span className="warning-text">⚠ Exceeds session time ({availMins} mins)</span>
                      )}
                      {overAllowed && (
                        <span className="over-time-text">⚠ Would exceed total allowed time</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted">No students for this session.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{marginTop:'16px',display:'flex',gap:'10px'}}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save All'}
          </button>
          <Link to={`/projects/${id}/sessions`} className="btn btn-secondary">Back to Sessions</Link>
        </div>
      </form>
    </div>
  );
}

export default AttendanceEntryPage;
