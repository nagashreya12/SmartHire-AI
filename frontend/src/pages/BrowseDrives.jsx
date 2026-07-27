import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function BrowseDrives() {
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/drives')
      .then((res) => setDrives(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load drives'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto mt-10 px-4 pb-16">
      <h1 className="text-3xl font-bold mb-2">🏢 Open Company Drives</h1>
      <p className="text-gray-500 mb-8">Browse open positions and apply directly with your resume.</p>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-6 text-sm">{error}</div>}

      {loading ? (
        <p className="text-gray-500">Loading drives...</p>
      ) : drives.length === 0 ? (
        <p className="text-gray-500">No open drives right now. Check back soon!</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {drives.map((d) => (
            <div key={d._id} className="bg-white p-6 rounded-xl shadow-md flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2 gap-2">
                  <h2 className="text-lg font-bold">{d.companyName}</h2>
                  <span
                    className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                      d.type === 'internship' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {d.type === 'internship' ? 'Internship' : 'Full-time'}
                  </span>
                </div>
                <h3 className="font-medium text-gray-800 mb-2">{d.driveTitle}</h3>
                {d.stipend && <p className="text-sm text-gray-600 mb-2">💰 {d.stipend}</p>}
                {d.requirements && <p className="text-sm text-gray-500 mb-3 line-clamp-3">{d.requirements}</p>}
              </div>
              <Link
                to={`/apply/${d._id}`}
                className="mt-2 bg-indigo-600 text-white text-center py-2 rounded hover:bg-indigo-700"
              >
                Apply Now
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
