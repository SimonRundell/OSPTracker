/**
 * SessionListPage - table of sessions for a project.
 * @module SessionListPage
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingSpinner } from '../shared/LoadingSpinner.jsx';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { SessionFormModal } from './SessionFormModal.jsx';
import * as api from '../../api/api.js';

/**
 * Lists all sessions for a project with links to attendance entry.
 */
export function SessionListPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [project, setProject]       = useState(null);
  const [sessions, setSessions]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [proj, sess] = await Promise.all([
        api.getOneProject(token, id),
        api.getSessionsForProject(token, id),
      ]);
      setProject(proj);
      setSessions(sess);
    } catch {
      setError('Could not load sessions.');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { loadData(); }, [loadData]);

  /**
   * Delete a session, with confirmation for those with attendance.
   * @param {number} sessionId
   * @param {boolean} force
   */
  const handleDelete = async (sessionId, force = false) => {
    try {
      await api.deleteSession(token, sessionId, force);
      setConfirmDelete(null);
      loadData();
    } catch (err) {
      if (err.response?.data?.conflict) {
        setConfirmDelete({ sessionId, message: err.response.data.message });
      } else {
        setError(err.response?.data?.message || 'Could not delete session.');
      }
    }
  };

  /**
   * Format a time string HH:MM:SS → HH:MM.
   * @param {string} t
   * @returns {string}
   */
  const fmt = (t) => (t || '').substring(0, 5);

  const totalAvailable = sessions.reduce((sum, s) => sum + parseFloat(s.available_minutes || 0), 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <div className="breadcrumb">
        <Link to="/projects">Projects</Link><span>›</span>
        <Link to={`/projects/${id}`}>{project?.name || 'Project'}</Link><span>›</span>Sessions
      </div>

      <div className="page-header">
        <h2>Sessions — {project?.name}</h2>
        <div style={{display:'flex',gap:'8px'}}>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Session</button>
          <Link to={`/reports/${id}`} className="btn btn-outline">Report</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Start</th>
              <th>End</th>
              <th>Avail. Mins</th>
              <th>Type</th>
              <th>Supervisor</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.session_id}>
                <td>{s.session_number}</td>
                <td>{s.session_date}</td>
                <td>{fmt(s.start_time)}</td>
                <td>{fmt(s.end_time)}</td>
                <td>{Math.round(parseFloat(s.available_minutes))}</td>
                <td><span className={`badge badge-${s.session_type}`}>{s.session_type}</span></td>
                <td>{s.supervisor_name}</td>
                <td>
                  <div className="td-actions">
                    <Link
                      to={`/projects/${id}/sessions/${s.session_id}/attendance`}
                      className="btn btn-secondary btn-sm"
                    >
                      Attendance
                    </Link>
                    {user?.role === 'admin' && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.session_id)}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={8} className="text-center text-muted">No sessions yet.</td></tr>
            )}
          </tbody>
          {sessions.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="text-right">Total available class time:</td>
                <td>{Math.round(totalAvailable)} mins</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showForm && (
        <SessionFormModal
          projectId={parseInt(id)}
          onClose={() => setShowForm(false)}
          onCreated={loadData}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={confirmDelete.message}
          confirmLabel="Yes, Delete Session"
          onConfirm={() => handleDelete(confirmDelete.sessionId, true)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export default SessionListPage;
