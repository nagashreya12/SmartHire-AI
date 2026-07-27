import { useEffect, useState } from 'react';
import api from '../api/axios';

const statusColor = {
  applied: 'bg-gray-100 text-gray-700',
  shortlisted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700'
};

export default function MyApplications() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/applications/my')
      .then((res) => setApps(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto mt-10 px-4 pb-16">
      <h1 className="text-3xl font-bold mb-6">📋 My Applications</h1>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : apps.length === 0 ? (
        <p className="text-gray-500">You haven't applied to any drives yet.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Company</th>
                <th className="p-3">Drive</th>
                <th className="p-3">Type</th>
                <th className="p-3">ATS Score</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a._id} className="border-t">
                  <td className="p-3 font-medium">{a.drive?.companyName}</td>
                  <td className="p-3">{a.drive?.driveTitle}</td>
                  <td className="p-3 capitalize">{a.drive?.type}</td>
                  <td className="p-3">{a.atsScore != null ? `${a.atsScore}/100` : 'Not yet analyzed'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColor[a.status]}`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
