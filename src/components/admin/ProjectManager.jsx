/**
 * ProjectManager - CRUD table for projects (admin only).
 * @module ProjectManager
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import * as api from '../../api/api.js';

/**
 * Project management table with create, edit and toggle active status.
 */
export function ProjectManager() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);

  const currentYear = new Date().getFullYear();
  const blankForm = {
    name: '', description: '', year: currentYear, centre_number: '54221',
    base_hours: 30, start_date: '', end_date: '', is_active: 1,
  };
  const [form, setForm] = useState(blankForm);

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.getAllProjects(token);
      setProjects(data);
    } catch {
      setError('Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const openCreate = () => { setEditing(null); setForm(blankForm); setError(''); setShowForm(true); };
  const openEdit   = (p) => {
    setEditing(p);
    setForm({
      id: p.id, name: p.name, description: p.description || '',
      year: p.year, centre_number: p.centre_number, base_hours: p.base_hours,
      start_date: p.start_date || '', end_date: p.end_date || '',
      is_active: p.is_active,
    });
    setError('');
    setShowForm(true);
  };

  /**
   * Submit create or update.
   * @param {React.FormEvent} e
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name) { setError('Project name is required.'); return; }
    try {
      if (editing) {
        await api.updateProject(token, form);
      } else {
        await api.createProject(token, form);
      }
      setShowForm(false);
      loadProjects();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save project.');
    }
  };

  /**
   * Toggle a project's active status.
   * @param {object} project
   */
  const handleToggleActive = async (project) => {
    try {
      await api.updateProject(token, { ...project, is_active: parseInt(project.is_active) ? 0 : 1 });
      loadProjects();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update project.');
    }
  };

  if (loading) return <p>Loading projects…</p>;

  return (
    <div>
      <div className="page-header">
        <h3>Projects</h3>
        <button className="btn btn-primary" onClick={openCreate}>+ New Project</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Year</th>
              <th>Centre</th>
              <th>Base Hours</th>
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.year}</td>
                <td>{p.centre_number}</td>
                <td>{p.base_hours}h</td>
                <td>{p.start_date || '—'}</td>
                <td>{p.end_date   || '—'}</td>
                <td><span className={`badge badge-${parseInt(p.is_active) ? 'active' : 'inactive'}`}>{parseInt(p.is_active) ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div className="td-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    <button
                      className={`btn btn-sm ${parseInt(p.is_active) ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => handleToggleActive(p)}
                    >
                      {parseInt(p.is_active) ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr><td colSpan={8} className="text-center text-muted">No projects found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>{editing ? 'Edit Project' : 'New Project'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-danger">{error}</div>}
                <div className="form-group">
                  <label>Project Name <span className="text-danger">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="e.g. T Level Digital — 2026" />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Year</label>
                    <input type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} min="2020" max="2099" required />
                  </div>
                  <div className="form-group">
                    <label>Centre Number</label>
                    <input type="text" value={form.centre_number} onChange={e => setForm({...form, centre_number: e.target.value})} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Base Hours</label>
                  <input type="number" value={form.base_hours} onChange={e => setForm({...form, base_hours: e.target.value})} min="1" step="0.5" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : 'Create Project'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectManager;
