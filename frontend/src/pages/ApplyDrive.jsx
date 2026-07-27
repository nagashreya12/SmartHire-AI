import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function ApplyDrive() {
  const { driveId } = useParams();
  const navigate = useNavigate();
  const [drive, setDrive] = useState(null);
  const [form, setForm] = useState({ name: '', contact: '', education: '', appliedRole: '' });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api
      .get(`/drives/${driveId}`)
      .then((res) => setDrive(res.data))
      .catch(() => setLoadError('Drive not found or no longer available.'));
  }, [driveId]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!file) return setError('Please upload your resume (PDF).');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('driveId', driveId);
      formData.append('name', form.name);
      formData.append('contact', form.contact);
      formData.append('education', form.education);
      formData.append('appliedRole', form.appliedRole || drive?.driveTitle || '');
      formData.append('resume', file);

      await api.post('/applications', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess(true);
      setTimeout(() => navigate('/my-applications'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Application failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return <div className="max-w-xl mx-auto mt-10 px-4 text-red-600">{loadError}</div>;
  }

  return (
    <div className="max-w-xl mx-auto mt-10 px-4 pb-16">
      <div className="bg-white p-8 rounded-xl shadow-md">
        {drive && (
          <div className="mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold">{drive.companyName}</h1>
            <p className="text-gray-600">
              {drive.driveTitle} · {drive.type === 'internship' ? 'Internship' : 'Full-time'}
            </p>
            {drive.stipend && <p className="text-sm text-gray-500 mt-1">💰 {drive.stipend}</p>}
          </div>
        )}

        <h2 className="text-lg font-semibold mb-4">Apply Now</h2>
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded">{error}</p>}

        {success ? (
          <p className="text-green-600 font-medium">✅ Application submitted! Redirecting to your applications...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input name="name" value={form.name} onChange={handleChange} required className="w-full border p-2 rounded mb-3" />

            <label className="block text-sm font-medium mb-1">Contact Number / Email</label>
            <input name="contact" value={form.contact} onChange={handleChange} required className="w-full border p-2 rounded mb-3" />

            <label className="block text-sm font-medium mb-1">Education (e.g. B.Tech CSE, XYZ University, 2026)</label>
            <input name="education" value={form.education} onChange={handleChange} required className="w-full border p-2 rounded mb-3" />

            <label className="block text-sm font-medium mb-1">Role You're Applying For</label>
            <input
              name="appliedRole"
              value={form.appliedRole}
              onChange={handleChange}
              placeholder={drive?.driveTitle || ''}
              className="w-full border p-2 rounded mb-3"
            />

            <label className="block text-sm font-medium mb-1">Resume (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full mb-4 text-sm"
            />

            <button
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
