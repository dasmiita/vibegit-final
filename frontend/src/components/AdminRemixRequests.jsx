import React, { useState, useEffect } from 'react';
import { fetchRemixRequests, respondToRemixRequest } from '../api/remixApi';

const AdminRemixRequests = ({ projectId }) => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const loadRequests = async () => {
    try {
      const res = await fetchRemixRequests(projectId);
      setPendingRequests(res.data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch requests: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, [projectId]);

  const handleRespond = async (requestId, action) => {
    setActionLoading(requestId);
    try {
      await respondToRemixRequest(projectId, requestId, action);
      setPendingRequests(prev => prev.filter(r => r._id !== requestId));
    } catch (err) {
      alert("Error responding to request");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="text-gray-400 p-4">Loading requests...</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;

  return (
    <div className="mt-6 border border-gray-700 rounded-lg p-4 bg-gray-900">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold text-white mb-0">Remix Requests & Contributor Changes</h3>
          {pendingRequests.length > 0 && (
            <span className="bg-red-600 text-white text-xs px-3 py-1 rounded-full font-bold">
              Remix Requests ({pendingRequests.length})
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 leading-relaxed mb-0">
          This section allows project owners to manage incoming remix requests and review proposed changes from contributors. When a user requests to remix your project, their request will appear here for approval. Once approved, the contributor will receive access to create a private working branch where they can safely make edits without affecting the main project. Any changes submitted by contributors will also be listed here as sync requests, allowing you to review, approve, or reject updates before merging them into the main project. This ensures that all modifications remain secure, trackable, and under your control while enabling smooth collaboration.
        </p>
      </div>

      {pendingRequests.length === 0 ? (
        <p className="text-gray-400">No pending remix requests</p>
      ) : (
        <div className="space-y-3 flex flex-col gap-3">
          {pendingRequests.map(req => (
            <div key={req._id} className="border border-gray-700 bg-gray-800 rounded p-3 flex justify-between items-center hover:border-gray-600 transition">
              <div>
                <p className="text-sm text-gray-300 m-0"><span className="font-semibold text-white">User:</span> @{req.userId?.username || req.userId || 'Unknown'}</p>
                <p className="text-sm text-gray-400 italic m-0 mt-1">"{req.message}"</p>
                <p className="text-xs text-yellow-500 mt-2 m-0 bg-yellow-500/10 w-max px-2 py-1 rounded">Status: {req.status}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleRespond(req._id, 'approve')}
                  disabled={actionLoading === req._id}
                  className="px-3 py-1.5 border-none bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded disabled:opacity-50"
                >
                  {actionLoading === req._id ? "..." : "Approve"}
                </button>
                <button 
                  onClick={() => handleRespond(req._id, 'reject')}
                  disabled={actionLoading === req._id}
                  className="px-3 py-1.5 border-none bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded disabled:opacity-50"
                >
                  {actionLoading === req._id ? "..." : "Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminRemixRequests;
