import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'success' | 'error' | 'info'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api
      .get('/user/api-key/status')
      .then((res) => setHasKey(res.data.hasKey))
      .finally(() => setLoading(false));
  }, []);

  const showMessage = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
  };

  const handleTest = async () => {
    if (!apiKey.trim()) return showMessage('Enter an API key first', 'error');
    setTesting(true);
    showMessage('');
    try {
      await api.post('/user/api-key/test', { apiKey });
      showMessage('✅ Key is valid and working!', 'success');
    } catch (err) {
      showMessage(err.response?.data?.message || 'Key test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const saveKey = async (e) => {
    e.preventDefault();
    setSaving(true);
    showMessage('');
    try {
      await api.put('/user/api-key', { apiKey });
      showMessage('✅ Groq API key saved successfully!', 'success');
      setHasKey(true);
      setApiKey('');
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to save key', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async () => {
    if (!confirm('Remove your saved Groq API key?')) return;
    await api.delete('/user/api-key');
    setHasKey(false);
    showMessage('API key removed', 'info');
  };

  const msgColor =
    messageType === 'success' ? 'text-green-700 bg-green-50' : messageType === 'error' ? 'text-red-700 bg-red-50' : 'text-gray-600';

  return (
    <div className="max-w-xl mx-auto mt-10 px-4">
      <div className="bg-white p-8 rounded-xl shadow-md">
        <h2 className="text-2xl font-bold mb-2">⚙️ Settings</h2>
        <p className="text-gray-500 mb-6 text-sm">
          Add your free Groq API key here to enable AI-powered resume analysis. Your key is encrypted before it's stored.
        </p>

        {!loading && (
          <div className="mb-4 text-sm">
            Status:{' '}
            {hasKey ? (
              <span className="text-green-600 font-medium">🔑 API key configured</span>
            ) : (
              <span className="text-red-500 font-medium">No API key set</span>
            )}
          </div>
        )}

        <form onSubmit={saveKey}>
          <label className="block text-sm font-medium mb-1">Groq API Key</label>
          <input
            type="password"
            autoComplete="off"
            className="w-full border p-2 rounded mb-3"
            placeholder="gsk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Key'}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="bg-gray-100 px-4 py-2 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Key'}
            </button>
            {hasKey && (
              <button
                type="button"
                onClick={removeKey}
                className="bg-red-50 text-red-600 px-4 py-2 rounded hover:bg-red-100"
              >
                Remove Key
              </button>
            )}
          </div>
        </form>

        {message && <p className={`mt-4 text-sm p-2 rounded ${msgColor}`}>{message}</p>}

        <div className="mt-6 text-xs text-gray-500 border-t pt-4">
          Don't have a Groq API key? Get one for free at{' '}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 underline"
          >
            console.groq.com/keys
          </a>
        </div>
      </div>
    </div>
  );
}
