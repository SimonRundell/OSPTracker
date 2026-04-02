/**
 * Root application component with routing configuration.
 * @module App
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { NavBar } from './components/shared/NavBar.jsx';
import { ProtectedRoute } from './components/shared/ProtectedRoute.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import ChangePasswordPage from './components/auth/ChangePasswordPage.jsx';
import DashboardPage from './components/dashboard/DashboardPage.jsx';
import ProjectListPage from './components/projects/ProjectListPage.jsx';
import ProjectDetailPage from './components/projects/ProjectDetailPage.jsx';
import SessionListPage from './components/sessions/SessionListPage.jsx';
import AttendanceEntryPage from './components/sessions/AttendanceEntryPage.jsx';
import ReportPage from './components/reports/ReportPage.jsx';
import AdminPage from './components/admin/AdminPage.jsx';

/**
 * App - sets up AuthProvider and all routes.
 */
function App() {
  return (
    <AuthProvider>
      <NavBar />
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={
            <ProtectedRoute><ChangePasswordPage /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/projects" element={
            <ProtectedRoute><ProjectListPage /></ProtectedRoute>
          } />
          <Route path="/projects/:id" element={
            <ProtectedRoute><ProjectDetailPage /></ProtectedRoute>
          } />
          <Route path="/projects/:id/sessions" element={
            <ProtectedRoute><SessionListPage /></ProtectedRoute>
          } />
          <Route path="/projects/:id/sessions/:sessionId/attendance" element={
            <ProtectedRoute><AttendanceEntryPage /></ProtectedRoute>
          } />
          <Route path="/reports/:projectId" element={
            <ProtectedRoute><ReportPage /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin"><AdminPage /></ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </AuthProvider>
  );
}

export default App;
