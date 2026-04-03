/**
 * ReportPage - professional print-ready project report.
 * @module ReportPage
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingSpinner } from '../shared/LoadingSpinner.jsx';
import { ExportButtons } from './ExportButtons.jsx';
import * as api from '../../api/api.js';

/**
 * Full project report page with sessions, student summaries, and export.
 *
 * Sections:
 *  1. Project Summary — base hours, sessions completed, total scheduled time,
 *     remaining unscheduled time (base_hours×60 − scheduled; red when negative),
 *     student count, and project dates.
 *  2. Session Log — per-session table with a footer showing scheduled total and
 *     remaining unscheduled time.
 *  3. Student Summary — per-student allowed/used/remaining minutes with a
 *     per-session attendance breakdown.
 *
 * The college logo is shown in the report header and is included in print/PDF output.
 * Print styles force A4 landscape orientation.
 */
export function ReportPage() {
  const { projectId } = useParams();
  const { token } = useAuth();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.getProjectOverview(token, projectId);
        setData(result);
      } catch {
        setError('Could not load report data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, projectId]);

  /**
   * Format HH:MM:SS → HH:MM.
   * @param {string} t
   * @returns {string}
   */
  const fmt = (t) => (t || '').substring(0, 5);

  /**
   * Get progress bar class.
   * @param {number} pct
   * @returns {string}
   */
  const progressClass = (pct) => {
    if (pct >= 100) return 'danger';
    if (pct >= 80)  return 'accent';
    return 'success';
  };

  if (loading) return <LoadingSpinner />;
  if (error)   return <div className="page-container"><div className="alert alert-danger">{error}</div></div>;
  if (!data)   return null;

  const { project, sessions, students, total_available_minutes, generated_at } = data;
  const totalProjectMins  = Math.round(parseFloat(project.base_hours) * 60);
  const scheduledMins     = Math.round(parseFloat(total_available_minutes));
  const remainingMins     = totalProjectMins - scheduledMins;

  return (
    <div className="page-container">
      <div className="breadcrumb no-print">
        <Link to="/projects">Projects</Link><span>›</span>
        <Link to={`/projects/${projectId}`}>{project.name}</Link><span>›</span>Report
      </div>

      <ExportButtons reportData={data} projectName={project.name} />

      <div className="report-container">
        {/* ---- Header ---- */}
        <div className="report-header">
          <img src="/images/exeter_bw.png" alt="Exeter College" className="exeter-logo-image" style={{marginBottom:'10px'}} />
          <h1>{project.name}</h1>
          <div className="report-meta">
            Year: {project.year} &bull; Centre: {project.centre_number} &bull; Generated: {generated_at}
          </div>
        </div>

        {/* ---- Section 1: Project Summary ---- */}
        <div className="report-section">
          <h2>Project Summary</h2>
          <div className="table-wrapper">
            <table>
              <tbody>
                <tr><td style={{fontWeight:600,width:'220px'}}>Base Hours</td><td>{project.base_hours}h ({totalProjectMins} mins)</td></tr>
                <tr><td style={{fontWeight:600}}>Sessions Completed</td><td>{sessions.length}</td></tr>
                <tr><td style={{fontWeight:600}}>Total Scheduled Time</td><td>{scheduledMins} mins ({(scheduledMins/60).toFixed(1)}h)</td></tr>
                <tr>
                  <td style={{fontWeight:600}}>Remaining Unscheduled Time</td>
                  <td style={{color: remainingMins < 0 ? 'var(--danger)' : 'inherit', fontWeight: 600}}>
                    {remainingMins} mins ({(remainingMins/60).toFixed(1)}h)
                  </td>
                </tr>
                <tr><td style={{fontWeight:600}}>Students Enrolled</td><td>{students.length}</td></tr>
                <tr><td style={{fontWeight:600}}>Start Date</td><td>{project.start_date || '—'}</td></tr>
                <tr><td style={{fontWeight:600}}>End Date</td><td>{project.end_date || '—'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- Section 2: Session Log ---- */}
        <div className="report-section">
          <h2>Session Log</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Available Mins</th>
                  <th>Type</th>
                  <th>Supervisor</th>
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
                    <td style={{textTransform:'capitalize'}}>{s.session_type}</td>
                    <td>{s.supervisor_name}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="text-right">Total scheduled:</td>
                  <td>{scheduledMins} mins</td>
                  <td colSpan={2}></td>
                </tr>
                <tr>
                  <td colSpan={4} className="text-right">Remaining unscheduled:</td>
                  <td style={{fontWeight:'bold', color: remainingMins < 0 ? 'var(--danger)' : 'inherit'}}>
                    {remainingMins} mins
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ---- Section 3: Student Summary ---- */}
        <div className="report-section">
          <h2>Student Summary</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Candidate #</th>
                  <th>CIS Ref</th>
                  <th>Surname</th>
                  <th>First Name</th>
                  <th>+Ext%</th>
                  <th>Rest Breaks</th>
                  <th>Allowed</th>
                  <th>Used</th>
                  <th>Remaining</th>
                  <th>% Used</th>
                  {sessions.map(s => <th key={s.session_id}>S{s.session_number}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  const pct = s.total_minutes_allowed > 0
                    ? Math.round((s.total_minutes_used / s.total_minutes_allowed) * 100)
                    : 0;
                  const attMap = {};
                  (s.attendance || []).forEach(a => { attMap[a.session_number] = a.minutes_present; });
                  return (
                    <tr key={s.project_student_id}>
                      <td>{s.candidate_number}</td>
                      <td>{s.cis_ref || '—'}</td>
                      <td>{s.surname}</td>
                      <td>{s.first_name}</td>
                      <td>{s.time_extension_percent > 0 ? `+${s.time_extension_percent}%` : '—'}</td>
                      <td>{parseInt(s.rest_breaks) ? 'Yes' : '—'}</td>
                      <td>{s.total_minutes_allowed}</td>
                      <td>{s.total_minutes_used}</td>
                      <td className={s.minutes_remaining < 0 ? 'text-danger' : ''}>{s.minutes_remaining}</td>
                      <td>
                        <div className="progress-track" style={{minWidth:'60px'}}>
                          <div className={`progress-bar ${progressClass(pct)}`} style={{width:`${Math.min(pct,100)}%`}}></div>
                        </div>
                        <span style={{fontSize:'0.8rem'}}>{pct}%</span>
                      </td>
                      {sessions.map(sess => (
                        <td key={sess.session_id} className="text-right">
                          {attMap[sess.session_number] ?? 0}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportPage;
