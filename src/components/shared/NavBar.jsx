/**
 * NavBar - Fixed top navigation bar.
 * @module NavBar
 */
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Top navigation bar with links and logout button.
 */
export function NavBar() {
  const { user, logoutUser } = useAuth();

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/dashboard">OSP Hours Tracker</Link>
      </div>
      <ul className="navbar-links">
        <li><NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink></li>
        <li><NavLink to="/projects" className={({ isActive }) => isActive ? 'active' : ''}>Projects</NavLink></li>
        {user.role === 'admin' && (
          <li><NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>Admin</NavLink></li>
        )}
      </ul>
      <div className="navbar-user">
        <span className="navbar-username">{user.role === 'admin' ? '★ ' : ''}{user.first_name || 'User'}</span>
        <button className="btn btn-outline-light btn-sm" onClick={logoutUser}>Log out</button>
      </div>
    </nav>
  );
}

export default NavBar;
