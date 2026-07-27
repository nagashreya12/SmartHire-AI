import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function RecruiterDashboard() {
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    driveTitle: '',
    jobDescription: '',
    requirements: '',
    stipend: '',
    type: 'internship'
  });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadDrives = () => {
    api
      .get('/drives/my')
      .then((res) => setDrives(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDrives();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api.post('/drives', form);
      setForm({ companyName: '', driveTitle: '', jobDescription: '', requirements: '', stipend: '', type: 'internship' });
      setShowForm(false);
      loadDrives();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create drive');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-10 px-4 pb-16">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-bold">🏢 My Drives</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : '+ New Drive'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow-md mb-8">
          <h2 className="font-semibold mb-4">Create a New Drive</h2>
          {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded">{error}</p>}

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Company Name</label>
              <input
                name="companyName"
                value={form.companyName}
                onChange={handleChange}
                required
                className="w-full border p-2 rounded"
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Drive Title</label>
              <input
                name="driveTitle"
                value={form.driveTitle}
                onChange={handleChange}
                required
                className="w-full border p-2 rounded"
                placeholder="e.g. Drive 1 - SDE Internship"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stipend / CTC</label>
              <input
                name="stipend"
                value={form.stipend}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                placeholder="e.g. ₹25,000/month or ₹8 LPA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select name="type" value={form.type} onChange={handleChange} className="w-full border p-2 rounded">
                <option value="internship">Internship</option>
                <option value="fulltime">Full-time</option>
              </select>
            </div>
          </div>

          <label className="block text-sm font-medium mb-1">Requirements (skills, qualifications)</label>
          <textarea
            name="requirements"
            value={form.requirements}
            onChange={handleChange}
            className="w-full border p-2 rounded mb-4 h-20"
            placeholder="e.g. React, Node.js, MongoDB, good communication skills, CGPA 7+"
          />

          <label className="block text-sm font-medium mb-1">Job Description</label>
          <textarea
            name="jobDescription"
            value={form.jobDescription}
            onChange={handleChange}
            className="w-full border p-2 rounded mb-4 h-28"
            placeholder="Full job description — this is what the AI will match resumes against..."
          />

          <button
            disabled={creating}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Drive'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : drives.length === 0 ? (
        <p className="text-gray-500">You haven't created any drives yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {drives.map((d) => (
            <Link
              key={d._id}
              to={`/recruiter/drives/${d._id}`}
              className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start mb-2 gap-2">
                <h2 className="text-lg font-bold">{d.companyName}</h2>
                <span
                  className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                    d.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {d.status}
                </span>
              </div>
              <h3 className="font-medium text-gray-800 mb-2">{d.driveTitle}</h3>
              <p className="text-sm text-gray-500">
                {d.applicantCount} applicant{d.applicantCount === 1 ? '' : 's'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
