import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Settings from './pages/Settings';
import BrowseDrives from './pages/BrowseDrives';
import ApplyDrive from './pages/ApplyDrive';
import MyApplications from './pages/MyApplications';
import RecruiterDashboard from './pages/RecruiterDashboard';
import DriveDetail from './pages/DriveDetail';

function homeFor(user) {
  if (!user) return '/login';
  return user.role === 'recruiter' ? '/recruiter/dashboard' : '/drives';
}

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <Navbar />
      <Routes>
        <Route path="/login" element={user ? <Navigate to={homeFor(user)} /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to={homeFor(user)} /> : <Register />} />

        {/* Student routes */}
        <Route
          path="/drives"
          element={
            <PrivateRoute role="student">
              <BrowseDrives />
            </PrivateRoute>
          }
        />
        <Route
          path="/apply/:driveId"
          element={
            <PrivateRoute role="student">
              <ApplyDrive />
            </PrivateRoute>
          }
        />
        <Route
          path="/my-applications"
          element={
            <PrivateRoute role="student">
              <MyApplications />
            </PrivateRoute>
          }
        />

        {/* Recruiter routes */}
        <Route
          path="/recruiter/dashboard"
          element={
            <PrivateRoute role="recruiter">
              <RecruiterDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/recruiter/drives/:id"
          element={
            <PrivateRoute role="recruiter">
              <DriveDetail />
            </PrivateRoute>
          }
        />

        {/* Shared */}
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />

        <Route path="*" element={<Navigate to={homeFor(user)} />} />
      </Routes>
    </div>
  );
}
