/**
 * ProjectListPage - shows all projects in a table.
 * @module ProjectListPage
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingSpinner } from '../shared/LoadingSpinner.jsx';
import * as api from '../../api/api.js';

/**
 * Table listing all projects with links to detail and sessions.
 */
export function ProjectListPage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getAllProjects(token);
        setProjects(data);
      } catch {
        setError('Could not load projects.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Projects</h2>
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
                <td><Link to={`/projects/${p.id}`}>{p.name}</Link></td>
                <td>{p.year}</td>
                <td>{p.centre_number}</td>
                <td>{p.base_hours}h</td>
                <td>{p.start_date || '—'}</td>
                <td>{p.end_date   || '—'}</td>
                <td>
                  <span className={`badge badge-${parseInt(p.is_active) ? 'active' : 'inactive'}`}>
                    {parseInt(p.is_active) ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="td-actions">
                    <Link to={`/projects/${p.id}`} className="btn btn-outline btn-sm">Detail</Link>
                    <Link to={`/projects/${p.id}/sessions`} className="btn btn-secondary btn-sm">Sessions</Link>
                    <Link to={`/reports/${p.id}`} className="btn btn-outline btn-sm">Report</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProjectListPage;
