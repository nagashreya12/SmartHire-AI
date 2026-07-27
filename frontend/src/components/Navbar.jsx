import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b shadow-sm px-6 py-4 flex justify-between items-center flex-wrap gap-3">
      <Link to="/" className="text-xl font-bold text-indigo-600">
        🎯 Campus Drive Portal
      </Link>
      {user && (
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-gray-600 text-sm hidden sm:inline">
            Hi, {user.name} <span className="text-xs text-gray-400">({user.role})</span>
          </span>

          {user.role === 'recruiter' ? (
            <Link to="/recruiter/dashboard" className="text-sm text-gray-700 hover:text-indigo-600">
              My Drives
            </Link>
          ) : (
            <>
              <Link to="/drives" className="text-sm text-gray-700 hover:text-indigo-600">
                Browse Drives
              </Link>
              <Link to="/my-applications" className="text-sm text-gray-700 hover:text-indigo-600">
                My Applications
              </Link>
            </>
          )}

          <Link to="/settings" className="text-sm text-gray-700 hover:text-indigo-600">
            ⚙️ Settings
          </Link>

          <button
            onClick={handleLogout}
            className="text-sm bg-red-500 text-white px-3 py-1.5 rounded-md hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
