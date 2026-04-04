import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import "./SyncRequests.css";

const BASE = "$env:REACT_APP_BASE_URL/uploads/";

export default function SyncRequests() {
  const { id } = useParams();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null); // reqId being acted on

  useEffect(() => {
    Promise.all([
      api.get(`/projects/${id}`),
      api.get(`/projects/${id}/sync-requests`)
    ]).then(([projRes, reqRes]) => {
      setProject(projRes.data);
      setRequests(reqRes.data);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleRespond = async (reqId, action) => {
    setResponding(reqId);
    try {
      const res = await api.post(`/projects/${id}/sync-request/${reqId}/respond`, { action });
      alert(res.data.message);
      // Remove from list after responding
      setRequests(prev => prev.filter(r => r._id !== reqId));
    } catch (err) {
      alert(err.response?.data?.message || "Failed");
    } finally {
      setResponding(null);
    }
  };

  if (loading) return <p className="loading">Loading...</p>;
  if (!project) return <p className="loading">Project not found.</p>;
  if (!user || user.id !== (project.userId?._id || project.userId)?.toString())
    return <p className="loading">Not authorized.</p>;

  return (
    <div className="sync-page">
      <div className="sync-header">
        <div>
          <h1>Sync Requests</h1>
          <p className="sync-subtitle">
            For <Link to={`/projects/${id}`} className="sync-project-link">{project.title}</Link>
          </p>
        </div>
        <span className="sync-count">{requests.length} pending</span>
      </div>

      {requests.length === 0 ? (
        <div className="sync-empty">
          <p>🎉 No pending sync requests</p>
          <span>When someone who remixed your project requests a sync, it will appear here.</span>
        </div>
      ) : (
        <div className="sync-list">
          {requests.map(req => {
            const remixUser = req.requestedBy;
            const remix = req.remixId;
            const avatarUrl = remixUser?.avatar ? `${BASE}${remixUser.avatar}` : null;

            return (
              <div key={req._id} className="sync-item">
                <div className="sync-item-left">
                  <div className="sync-avatar">
                    {avatarUrl
                      ? <img src={avatarUrl} alt="" />
                      : <div className="sync-avatar-placeholder">{remixUser?.username?.[0]?.toUpperCase()}</div>
                    }
                  </div>
                  <div className="sync-info">
                    <p className="sync-text">
                      <Link to={`/profile/${remixUser?._id}`} className="sync-user">
                        @{remixUser?.username || "unknown"}
                      </Link>
                      {" "}wants to sync their remix with your latest changes
                    </p>
                    <Link to={`/projects/${remix?._id}`} className="sync-remix-link">
                      View remix: {remix?.title || "Untitled"}
                    </Link>
                    <span className="sync-date">
                      {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </div>

                <div className="sync-actions">
                  <button
                    className="sync-approve-btn"
                    disabled={responding === req._id}
                    onClick={() => handleRespond(req._id, "approve")}
                  >
                    {responding === req._id ? "..." : "✓ Approve"}
                  </button>
                  <button
                    className="sync-decline-btn"
                    disabled={responding === req._id}
                    onClick={() => handleRespond(req._id, "decline")}
                  >
                    {responding === req._id ? "..." : "✕ Decline"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
