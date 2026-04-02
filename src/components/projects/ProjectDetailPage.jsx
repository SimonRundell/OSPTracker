/**
 * ProjectDetailPage - project info + enrolled students table.
 * @module ProjectDetailPage
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingSpinner } from '../shared/LoadingSpinner.jsx';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { EnrolStudentsModal } from './EnrolStudentsModal.jsx';
import * as api from '../../api/api.js';

/**
 * Detail view for a single project with enrolled student management.
 */
export function ProjectDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [project, setProject]       = useState(null);
  const [students, setStudents]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showEnrol, setShowEnrol]   = useState(false);
  const [editingPs, setEditingPs]   = useState(null);
  const [confirmUnenrol, setConfirmUnenrol] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [proj, studs] = await Promise.all([
        api.getOneProject(token, id),
        api.getStudentsForProject(token, id),
      ]);
      setProject(proj);
      setStudents(studs);
    } catch {
      setError('Could not load project.');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { loadData(); }, [loadData]);

  /**
   * Unenrol a student with optional force-confirm.
   * @param {number} psId - project_student_id
   * @param {boolean} force
   */
  const handleUnenrol = async (psId, force = false) => {
    try {
      await api.unenrolStudent(token, { project_student_id: psId, confirm: force });
      setConfirmUnenrol(null);
      loadData();
    } catch (err) {
      if (err.response?.data?.conflict) {
        setConfirmUnenrol({ psId, message: err.response.data.message });
      } else {
        setError(err.response?.data?.message || 'Could not unenrol student.');
      }
    }
  };

  /**
   * Save updated enrolment (access arrangements).
   * @param {React.FormEvent} e
   */
  const handleSaveEnrolment = async (e) => {
    e.preventDefault();
    try {
      await api.updateEnrolment(token, {
        project_student_id: editingPs.project_student_id,
        time_extension_percent: parseInt(editingPs.time_extension_percent),
        rest_breaks: editingPs.rest_breaks ? 1 : 0,
        notes: editingPs.notes || '',
      });
      setEditingPs(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update enrolment.');
    }
  };

  /**
   * Return progress bar class based on percentage.
   * @param {number} pct
   * @returns {string}
   */
  const progressClass = (pct) => {
    if (pct >= 100) return 'danger';
    if (pct >= 80)  return 'accent';
    return 'success';
  };

  if (loading) return <LoadingSpinner />;
  if (!project) return <div className="page-container"><div className="alert alert-danger">{error || 'Project not found.'}</div></div>;

  return (
    <div className="page-container">
      <div className="breadcrumb">
        <Link to="/projects">Projects</Link><span>›</span>{project.name}
      </div>

      <div className="page-header">
        <h2>{project.name}</h2>
        <div style={{display:'flex',gap:'8px'}}>
          <Link to={`/projects/${id}/sessions`} className="btn btn-secondary">Sessions</Link>
          <Link to={`/reports/${id}`} className="btn btn-outline">Report</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-wrapper" style={{marginBottom:'20px',padding:'16px'}}>
        <table style={{width:'auto'}}>
          <tbody>
            <tr><td style={{fontWeight:600,paddingRight:'24px'}}>Year</td><td>{project.year}</td></tr>
            <tr><td style={{fontWeight:600}}>Centre</td><td>{project.centre_number}</td></tr>
            <tr><td style={{fontWeight:600}}>Base Hours</td><td>{project.base_hours}h ({parseFloat(project.base_hours)*60} mins)</td></tr>
            <tr><td style={{fontWeight:600}}>Start Date</td><td>{project.start_date || '—'}</td></tr>
            <tr><td style={{fontWeight:600}}>End Date</td><td>{project.end_date || '—'}</td></tr>
            <tr><td style={{fontWeight:600}}>Students</td><td>{project.student_count}</td></tr>
            <tr><td style={{fontWeight:600}}>Sessions</td><td>{project.session_count}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="page-header">
        <h3>Enrolled Students</h3>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowEnrol(true)}>+ Enrol Student</button>
        )}
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Candidate #</th>
              <th>Surname</th>
              <th>First Name</th>
              <th>Extension</th>
              <th>Rest Breaks</th>
              <th>Allowed (mins)</th>
              <th>Used (mins)</th>
              <th>Remaining</th>
              <th>% Used</th>
              {user?.role === 'admin' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {students.map(s => {
              const pct = s.total_minutes_allowed > 0
                ? Math.round((s.total_minutes_used / s.total_minutes_allowed) * 100)
                : 0;
              return (
                <tr key={s.project_student_id}>
                  <td>{s.candidate_number}</td>
                  <td>{s.surname}</td>
                  <td>{s.first_name}</td>
                  <td>{s.time_extension_percent > 0 ? `+${s.time_extension_percent}%` : '—'}</td>
                  <td>{parseInt(s.rest_breaks) ? 'Yes' : '—'}</td>
                  <td>{s.total_minutes_allowed}</td>
                  <td>{s.total_minutes_used}</td>
                  <td className={s.minutes_remaining < 0 ? 'text-danger' : ''}>{s.minutes_remaining}</td>
                  <td>
                    <div className="progress-track">
                      <div className={`progress-bar ${progressClass(pct)}`} style={{width:`${Math.min(pct,100)}%`}}></div>
                    </div>
                    {pct}%
                  </td>
                  {user?.role === 'admin' && (
                    <td>
                      <div className="td-actions">
                        <button className="btn btn-outline btn-sm" onClick={() => setEditingPs({...s})}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleUnenrol(s.project_student_id)}>Remove</button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr><td colSpan={user?.role === 'admin' ? 10 : 9} className="text-center text-muted">No students enrolled.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showEnrol && (
        <EnrolStudentsModal
          projectId={parseInt(id)}
          onClose={() => setShowEnrol(false)}
          onEnrolled={loadData}
        />
      )}

      {editingPs && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Edit Access Arrangements — {editingPs.surname}, {editingPs.first_name}</h3>
              <button className="modal-close" onClick={() => setEditingPs(null)}>×</button>
            </div>
            <form onSubmit={handleSaveEnrolment}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Time Extension</label>
                  <select value={editingPs.time_extension_percent} onChange={e => setEditingPs({...editingPs, time_extension_percent: e.target.value})}>
                    <option value={0}>None (0%)</option>
                    <option value={10}>10% extra time</option>
                    <option value={20}>20% extra time</option>
                    <option value={25}>25% extra time</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>
                    <input type="checkbox" checked={!!parseInt(editingPs.rest_breaks)} onChange={e => setEditingPs({...editingPs, rest_breaks: e.target.checked})} />
                    {' '}Rest breaks
                  </label>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={editingPs.notes || ''} onChange={e => setEditingPs({...editingPs, notes: e.target.value})} rows={2} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingPs(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmUnenrol && (
        <ConfirmDialog
          message={confirmUnenrol.message}
          confirmLabel="Yes, Remove Student"
          onConfirm={() => handleUnenrol(confirmUnenrol.psId, true)}
          onCancel={() => setConfirmUnenrol(null)}
        />
      )}
    </div>
  );
}

export default ProjectDetailPage;
