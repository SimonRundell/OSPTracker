/**
 * DashboardPage - shows all active projects as cards with progress bars.
 * Admin sees all projects; staff see projects they have supervised.
 * @module DashboardPage
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingSpinner } from '../shared/LoadingSpinner.jsx';
import * as api from '../../api/api.js';

/**
 * Dashboard with project overview cards.
 */
export function DashboardPage() {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getAllProjects(token);
        setProjects(data.filter(p => parseInt(p.is_active) === 1));
      } catch {
        setError('Could not load projects.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  /**
   * Returns progress bar CSS modifier class based on % used.
   * @param {number} pct
   * @returns {string}
   */
  const progressClass = (pct) => {
    if (pct >= 100) return 'danger';
    if (pct >= 80)  return 'accent';
    return 'success';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Dashboard</h2>
        {user?.role === 'admin' && (
          <Link to="/admin" className="btn btn-primary">Manage System</Link>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {projects.length === 0 && !error && (
        <p className="text-muted">No active projects found. {user?.role === 'admin' ? <Link to="/admin">Create one in Admin.</Link> : 'Contact an administrator.'}</p>
      )}

      <div className="card-grid">
        {projects.map(project => (
          <div key={project.id} className="project-card">
            <div className="project-card-header">
              <h3>{project.name}</h3>
              <span className="badge">{project.year}</span>
            </div>
            <div className="project-card-body">
              <p className="text-muted" style={{fontSize:'0.82rem'}}>{project.centre_number}</p>
              <p>{project.base_hours}h base allowance</p>
              <p>{project.student_count || 0} students enrolled</p>
            </div>
            <div className="project-card-footer">
              <Link to={`/projects/${project.id}/sessions`} className="btn btn-secondary btn-sm">Sessions</Link>
              <Link to={`/reports/${project.id}`} className="btn btn-outline btn-sm">Report</Link>
              <Link to={`/projects/${project.id}`} className="btn btn-outline btn-sm">Detail</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DashboardPage;
