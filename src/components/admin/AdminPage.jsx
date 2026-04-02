/**
 * AdminPage - tabbed admin panel for staff, students, and projects.
 * @module AdminPage
 */
import { useState } from 'react';
import { StaffManager } from './StaffManager.jsx';
import { StudentManager } from './StudentManager.jsx';
import { ProjectManager } from './ProjectManager.jsx';

const TABS = ['Staff', 'Students', 'Projects'];

/**
 * Tabbed admin container.
 */
export function AdminPage() {
  const [activeTab, setActiveTab] = useState('Staff');

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Administration</h2>
      </div>

      <div className="tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-btn${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Staff'    && <StaffManager />}
      {activeTab === 'Students' && <StudentManager />}
      {activeTab === 'Projects' && <ProjectManager />}
    </div>
  );
}

export default AdminPage;
