/**
 * Authentication context and provider for the OSP Hours Tracker.
 * Provides { user, token, loginUser, logoutUser } to the whole app.
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
    const stored = localStorage.getItem('osp_token');
    if (stored) {
      const payload = decodeToken(stored);
      if (payload && payload.exp > Date.now() / 1000) {
        setToken(stored);
        setUser(payload);
      } else {
        localStorage.removeItem('osp_token');
      }
    }
    setLoading(false);
  }, []);

  /**
   * Log in with username and password.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<void>}
   */
  const loginUser = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    const payload = decodeToken(data.token);
    localStorage.setItem('osp_token', data.token);
    setToken(data.token);
    setUser(payload);
    console.log(payload)
    if (data.staff.must_change_password) {
      navigate('/change-password');
    } else {
      navigate('/dashboard');
    }
  }, [navigate]);

  /**
   * Log out and clear session.
   * @returns {void}
   */
  const logoutUser = useCallback(() => {
    localStorage.removeItem('osp_token');
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
 * @returns {{ user: object|null, token: string|null, loginUser: Function, logoutUser: Function }}
 */
export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
