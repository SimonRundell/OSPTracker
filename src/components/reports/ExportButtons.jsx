/**
 * ExportButtons - CSV and Excel export, and print trigger.
 * @module ExportButtons
 */
import * as XLSX from 'xlsx';

/**
 * Trigger a file download from a Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Convert data to CSV string.
 * @param {string[][]} rows
 * @returns {string}
 */
function toCSV(rows) {
  return rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(',')
  ).join('\r\n');
}

/**
 * Format HH:MM:SS → HH:MM.
 * @param {string} t
 * @returns {string}
 */
const fmt = (t) => (t || '').substring(0, 5);

/**
 * Export project report data as CSV (two sections separated by blank line).
 * @param {object} reportData
 * @param {string} projectName
 */
export function exportCSV(reportData, projectName) {
  const { project, sessions, students } = reportData;

  // Sessions section
  const sessionRows = [
    [`OSP Hours Tracker — ${project.name} (${project.year})`],
    [],
    ['SESSIONS'],
    ['#', 'Date', 'Start', 'End', 'Available Mins', 'Type', 'Supervisor'],
    ...sessions.map(s => [
      s.session_number,
      s.session_date,
      fmt(s.start_time),
      fmt(s.end_time),
      Math.round(parseFloat(s.available_minutes)),
      s.session_type,
      s.supervisor_name,
    ]),
    ['', '', '', 'Total:', Math.round(parseFloat(reportData.total_available_minutes))],
    [],
    ['STUDENTS'],
    ['Candidate #', 'CIS Ref', 'Surname', 'First Name', '+Ext%', 'Rest Breaks', 'Allowed Mins', 'Used Mins', 'Remaining', '% Used',
      ...sessions.map(s => `Session ${s.session_number}`)],
    ...students.map(s => {
      const pct = s.total_minutes_allowed > 0
        ? Math.round((s.total_minutes_used / s.total_minutes_allowed) * 100)
        : 0;
      const attMap = {};
      (s.attendance || []).forEach(a => { attMap[a.session_number] = a.minutes_present; });
      return [
        s.candidate_number,
        s.cis_ref || '',
        s.surname,
        s.first_name,
        s.time_extension_percent > 0 ? `+${s.time_extension_percent}%` : '0%',
        parseInt(s.rest_breaks) ? 'Yes' : 'No',
        s.total_minutes_allowed,
        s.total_minutes_used,
        s.minutes_remaining,
        `${pct}%`,
        ...sessions.map(sess => attMap[sess.session_number] ?? 0),
      ];
    }),
  ];

  const csv  = toCSV(sessionRows);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${projectName}_report.csv`);
}

/**
 * Export project report data as Excel workbook (two sheets).
 * @param {object} reportData
 * @param {string} projectName
 */
export function exportExcel(reportData, projectName) {
  const { project, sessions, students } = reportData;
  const wb = XLSX.utils.book_new();

  // Sessions sheet
  const sessRows = [
    ['#', 'Date', 'Start', 'End', 'Available Mins', 'Type', 'Supervisor', 'Notes'],
    ...sessions.map(s => [
      s.session_number,
      s.session_date,
      fmt(s.start_time),
      fmt(s.end_time),
      Math.round(parseFloat(s.available_minutes)),
      s.session_type,
      s.supervisor_name,
      s.notes || '',
    ]),
    ['', '', '', 'Total:', Math.round(parseFloat(reportData.total_available_minutes))],
  ];
  const wsS = XLSX.utils.aoa_to_sheet(sessRows);
  wsS['!cols'] = [6,12,8,8,14,12,20,30].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsS, 'Sessions');

  // Students sheet
  const stuHeaders = [
    'Candidate #', 'CIS Ref', 'Surname', 'First Name', 'Extension %', 'Rest Breaks',
    'Allowed Mins', 'Used Mins', 'Remaining', '% Used',
    ...sessions.map(s => `Sess ${s.session_number}`),
  ];
  const stuRows = students.map(s => {
    const pct = s.total_minutes_allowed > 0
      ? Math.round((s.total_minutes_used / s.total_minutes_allowed) * 100)
      : 0;
    const attMap = {};
    (s.attendance || []).forEach(a => { attMap[a.session_number] = a.minutes_present; });
    return [
      s.candidate_number,
      s.cis_ref || '',
      s.surname,
      s.first_name,
      `${s.time_extension_percent}%`,
      parseInt(s.rest_breaks) ? 'Yes' : 'No',
      s.total_minutes_allowed,
      s.total_minutes_used,
      s.minutes_remaining,
      `${pct}%`,
      ...sessions.map(sess => attMap[sess.session_number] ?? 0),
    ];
  });
  const wsT = XLSX.utils.aoa_to_sheet([stuHeaders, ...stuRows]);
  wsT['!cols'] = [14,12,16,14,12,12,14,12,12,10,
    ...sessions.map(() => ({ wch: 10 }))].map((w, i) => typeof w === 'number' ? { wch: w } : w);
  XLSX.utils.book_append_sheet(wb, wsT, 'Students');

  XLSX.writeFile(wb, `${projectName}_report.xlsx`);
}

/**
 * ExportButtons component — print, CSV and Excel export buttons.
 * @param {{ reportData: object, projectName: string }} props
 */
export function ExportButtons({ reportData, projectName }) {
  if (!reportData) return null;
  const safeName = (projectName || 'report').replace(/[^a-z0-9_-]/gi, '_');

  return (
    <div className="report-toolbar">
      <button className="btn btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
      <button className="btn btn-secondary" onClick={() => exportCSV(reportData, safeName)}>Export CSV</button>
      <button className="btn btn-success" onClick={() => exportExcel(reportData, safeName)}>Export Excel</button>
    </div>
  );
}

export default ExportButtons;
