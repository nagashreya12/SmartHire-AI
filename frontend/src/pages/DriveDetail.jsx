import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';

const statusColor = {
  applied: 'bg-gray-100 text-gray-700',
  shortlisted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700'
};

export default function DriveDetail() {
  const { id } = useParams();
  const [drive, setDrive] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [failures, setFailures] = useState([]);
  const [minScore, setMinScore] = useState(70);

  const load = async () => {
    try {
      const [driveRes, appsRes] = await Promise.all([
        api.get(`/drives/${id}`),
        api.get(`/applications/drive/${id}`)
      ]);
      setDrive(driveRes.data);
      setApplications(appsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load drive');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAnalyze = async () => {
    setError('');
    setMessage('');
    setFailures([]);
    setAnalyzing(true);
    try {
      const res = await api.post(`/drives/${id}/analyze`);
      setApplications(res.data.applications);
      setMessage(res.data.message);
      setFailures(res.data.failures || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (err.request ? 'Could not reach the server. If it was idle, wait a minute and try again.' : 'Analysis failed')
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleShortlist = async () => {
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/drives/${id}/shortlist`, { minScore: Number(minScore) });
      setApplications(res.data.applications);
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Shortlisting failed');
    }
  };

  const handleStatusChange = async (appId, status) => {
    try {
      await api.patch(`/applications/${appId}/status`, { status });
      setApplications(applications.map((a) => (a._id === appId ? { ...a, status } : a)));
    } catch (err) {
      setError('Failed to update status');
    }
  };

  const viewResume = (appId) => {
    const token = localStorage.getItem('token');
    window.open(`${api.defaults.baseURL}/applications/${appId}/resume?token=${token}`, '_blank');
  };

  const scoreColor = (score) =>
    score == null ? 'text-gray-400' : score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600';

  const analyzedCount = applications.filter((a) => a.atsScore != null).length;

  if (loading) return <div className="p-10 text-center text-gray-500">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto mt-10 px-4 pb-16">
      <Link to="/recruiter/dashboard" className="text-sm text-indigo-600 hover:underline">
        ← Back to My Drives
      </Link>

      {drive && (
        <div className="mt-3 mb-6">
          <h1 className="text-3xl font-bold">{drive.companyName}</h1>
          <p className="text-gray-600">
            {drive.driveTitle} · {drive.type === 'internship' ? 'Internship' : 'Full-time'}
            {drive.stipend && ` · ${drive.stipend}`}
          </p>
        </div>
      )}

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
      {message && <div className="bg-green-100 text-green-700 p-3 rounded mb-4 text-sm">{message}</div>}
      {failures.length > 0 && (
        <div className="bg-yellow-50 text-yellow-800 p-3 rounded mb-4 text-sm">
          <p className="font-medium mb-1">{failures.length} resume(s) could not be analyzed:</p>
          <ul className="list-disc ml-5">
            {failures.map((f, i) => (
              <li key={i}>
                {f.name}: {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-md mb-6 flex flex-wrap gap-4 items-center justify-between">
        <p className="text-sm text-gray-500">
          {applications.length} applicant{applications.length === 1 ? '' : 's'} · {analyzedCount} analyzed
        </p>

        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={handleAnalyze}
            disabled={analyzing || applications.length === 0}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {analyzing ? 'Analyzing with AI...' : '🤖 Analyze Resumes'}
          </button>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Shortlist ≥</label>
            <input
              type="number"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="w-16 border rounded p-1 text-sm"
            />
            <span className="text-sm text-gray-600">%</span>
            <button
              onClick={handleShortlist}
              disabled={analyzedCount === 0}
              className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-x-auto">
        <table className="w-full text-sm min-w-[850px]">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Education</th>
              <th className="p-3">Role</th>
              <th className="p-3">ATS Score</th>
              <th className="p-3">Status</th>
              <th className="p-3">Resume</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => (
              <tr key={a._id} className="border-t align-top">
                <td className="p-3 font-medium">{a.name}</td>
                <td className="p-3">{a.contact}</td>
                <td className="p-3">{a.education}</td>
                <td className="p-3">{a.appliedRole}</td>
                <td className={`p-3 font-bold ${scoreColor(a.atsScore)}`}>
                  {a.atsScore != null ? `${a.atsScore}/100` : '—'}
                </td>
                <td className="p-3">
                  <select
                    value={a.status}
                    onChange={(e) => handleStatusChange(a._id, e.target.value)}
                    className={`text-xs rounded-full px-2 py-1 border-0 ${statusColor[a.status]}`}
                  >
                    <option value="applied">Applied</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </td>
                <td className="p-3">
                  <button onClick={() => viewResume(a._id)} className="text-indigo-600 underline text-xs">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {applications.length === 0 && <p className="p-6 text-gray-500 text-sm">No applications yet.</p>}
      </div>
    </div>
  );
}
