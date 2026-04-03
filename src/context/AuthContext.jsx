/**
 * Authentication context and provider for the OSP Hours Tracker.
 * Provides { user, token, loginUser, logoutUser } to the whole app.
 *
 * The `user` object is a merge of the decoded JWT payload and the staff
 * record returned by the login endpoint, giving consumers access to both
 * auth claims (sub, role, exp) and profile fields (first_name, last_name,
 * username, id). Staff details are persisted to localStorage under the key
 * `osp_staff` so they survive a page refresh without a round-trip to the API.
 *
 * @module AuthContext
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/api.js';

/** @type {React.Context} */
const AuthContext = createContext(null);

/**
 * Decode a JWT payload without verifying (client-side only).
 * @param {string} token - JWT string
 * @returns {object|null} Decoded payload or null
 */
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/**
 * AuthProvider wraps the app and manages JWT state.
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
  const [token, setToken]   = useState(null);
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored      = localStorage.getItem('osp_token');
    const storedStaff = localStorage.getItem('osp_staff');
    if (stored) {
      const payload = decodeToken(stored);
      if (payload && payload.exp > Date.now() / 1000) {
        const staff = storedStaff ? JSON.parse(storedStaff) : {};
        setToken(stored);
        setUser({ ...payload, ...staff });
      } else {
        localStorage.removeItem('osp_token');
        localStorage.removeItem('osp_staff');
      }
    }
    setLoading(false);
  }, []);

  /**
   * Authenticate with the API. On success, persists the JWT to `osp_token`
   * and the staff profile to `osp_staff` in localStorage, then sets `user`
   * to the merged payload. Redirects to /change-password if the account has
   * must_change_password set, otherwise to /dashboard.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<void>}
   */
  const loginUser = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    const payload = decodeToken(data.token);
    localStorage.setItem('osp_token', data.token);
    localStorage.setItem('osp_staff', JSON.stringify(data.staff));
    setToken(data.token);
    setUser({ ...payload, ...data.staff });
    if (data.staff.must_change_password) {
      navigate('/change-password');
    } else {
      navigate('/dashboard');
    }
  }, [navigate]);

  /**
   * Clear the JWT and staff profile from localStorage, reset state,
   * and redirect to /login.
   * @returns {void}
   */
  const logoutUser = useCallback(() => {
    localStorage.removeItem('osp_token');
    localStorage.removeItem('osp_staff');
    setToken(null);
    setUser(null);
    navigate('/login');
  }, [navigate]);

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, token, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context.
 * @returns {{
 *   user: { sub: number, role: string, exp: number, id: number,
 *            username: string, first_name: string, last_name: string,
 *            must_change_password: number }|null,
 *   token: string|null,
 *   loginUser: Function,
 *   logoutUser: Function
 * }}
 */
export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
