import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Toast, { useToast } from "../components/Toast";
import Avatar from "../components/Avatar";
import CollaborationHub from "../components/CollaborationHub";
import RemixRequestButton from "../components/RemixRequestButton";
import AdminRemixRequests from "../components/AdminRemixRequests";
import "./ProjectDetail.css";

const BASE = "http://localhost:5000/uploads/";
const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
const CODE_EXTS  = ["js", "jsx", "ts", "tsx", "py", "html", "css", "json", "md", "txt", "sh", "java", "c", "cpp", "go", "rs"];

const STATUS_BADGE = {
  "completed":   { icon: "✅", label: "Completed",   cls: "status-completed" },
  "in-progress": { icon: "🚧", label: "In Progress", cls: "status-in-progress" },
  "idea":        { icon: "💡", label: "Idea",         cls: "status-idea" }
};

function getExt(name) { return name.split(".").pop().toLowerCase(); }
function isImage(name) { return IMAGE_EXTS.includes(getExt(name)); }
function isCode(name)  { return CODE_EXTS.includes(getExt(name)); }

function AvatarWrapper({ user, size = 32 }) {
  return <Avatar user={user} size={size} />;
}

function FileViewer({ file }) {
  const [expanded, setExpanded] = useState(false);
  const [codeContent, setCodeContent] = useState(null);
  const ext = getExt(file.name);
  const url = `${BASE}${file.path}`;

  const loadCode = async () => {
    if (codeContent !== null) { setExpanded(e => !e); return; }
    try {
      const res = await fetch(url);
      setCodeContent(await res.text());
      setExpanded(true);
    } catch { setCodeContent("Could not load file."); setExpanded(true); }
  };

  const fmt = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;

  return (
    <div className="file-viewer-item">
      <div className="file-row">
        <span className="file-icon">{isImage(file.name) ? "🖼️" : isCode(file.name) ? "📝" : "📄"}</span>
        <span className="file-name">{file.name}</span>
        <span className="file-ext">.{ext}</span>
        <span className="file-size">{fmt(file.size)}</span>
        <div className="file-actions">
          {(isCode(file.name) || isImage(file.name)) && (
            <button className="file-action-btn" onClick={loadCode}>{expanded ? "▲ Hide" : "▼ Preview"}</button>
          )}
          <a href={url} download={file.name} className="file-action-btn">⬇ Download</a>
        </div>
      </div>
      {expanded && (
        <div className="file-preview-area">
          {isImage(file.name)
            ? <img src={url} alt={file.name} className="file-img-preview" />
            : <pre className="file-code-preview">{codeContent}</pre>
          }
        </div>
      )}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toasts, show: showToast, dismiss } = useToast();

  const [project, setProject]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [comment, setComment]           = useState("");
  const [liked, setLiked]               = useState(false);
  const [likes, setLikes]               = useState(0);
  const [remixing, setRemixing]         = useState(false);
  const [activeVersion, setActiveVersion] = useState(null);

  // Sync / Access / Controls panel state
  const [showSyncPanel, setShowSyncPanel]         = useState(false); // For non-owners
  const [showControlsPanel, setShowControlsPanel] = useState(false); // For owners
  const [activeControlTab, setActiveControlTab]   = useState("remixRequests");
  const [syncRequests, setSyncRequests]           = useState([]);
  const [syncLoading, setSyncLoading]             = useState(false);
  const [respondingId, setRespondingId]           = useState(null);
  const [syncRequestSent, setSyncRequestSent]   = useState(false);
  const [syncSending, setSyncSending]           = useState(false);
  const [showSendConfirm, setShowSendConfirm]   = useState(false);
  const [followingAuthor, setFollowingAuthor]   = useState(false);

  useEffect(() => {
    api.get(`/projects/${id}`).then(res => {
      setProject(res.data);
      setLikes(res.data.likes?.length || 0);
      setLiked(user ? res.data.likes?.map(i => i.toString()).includes(user.id) : false);
      const owner = res.data.userId;
      const followers = owner?.followers || [];
      setFollowingAuthor(
        user ? followers.some((f) => f.toString() === String(user.id)) : false
      );
    }).finally(() => setLoading(false));
  }, [id, user]);

  const isOwner = user && project && user.id === (project.userId?._id || project.userId)?.toString();

  // When owner opens sync panel, load requests
  const handleOpenSyncPanel = async () => {
    setShowSyncPanel(p => !p);
    setShowAccessPanel(false);
    if (!showSyncPanel && isOwner) {
      setSyncLoading(true);
      try {
        const res = await api.get(`/projects/${id}/sync-requests`);
        setSyncRequests(res.data);
      } catch {}
      finally { setSyncLoading(false); }
    }
  };

  const handleRespond = async (reqId, action) => {
    setRespondingId(reqId);
    try {
      const res = await api.post(`/projects/${id}/sync-request/${reqId}/respond`, { action });
      setSyncRequests(prev => prev.filter(r => r._id !== reqId));
      if (action === "approve") {
        const updated = await api.get(`/projects/${id}`);
        setProject(updated.data);
        setShowSyncPanel(false);
      }
      showToast(res.data.message, action === "approve" ? "success" : "info", action === "approve" ? "Sync Approved ✅" : "Sync Declined");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed", "error", "Error");
    } finally {
      setRespondingId(null);
    }
  };

  const handleSendSyncRequest = async () => {
    setSyncSending(true);
    try {
      await api.post(`/projects/${id}/sync-request`);
      setSyncRequestSent(true);
      setShowSendConfirm(false);
      showToast("Your sync request was sent! The creator will review your changes.", "success", "Sync Request Sent 🚀");
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Could not send sync request";
      showToast(msg, "error", "Could Not Send Request");
    } finally {
      setSyncSending(false);
    }
  };

  const handleLike = async () => {
    if (!user) return navigate("/login");
    try {
      const res = await api.post(`/projects/${id}/like`);
      setLikes(res.data.likes);
      setLiked(res.data.liked);
      showToast(res.data.liked ? "Project Upvoted!" : "Upvote Removed", "success", "Success");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to upvote", "error", "Error");
    }
  };

  const handleFollowAuthor = async () => {
    if (!user) return navigate("/login");
    const uid = project.userId?._id || project.userId;
    if (!uid) return;
    try {
      const res = await api.post(`/users/${uid}/follow`);
      setFollowingAuthor(res.data.following);
      setProject((prev) => {
        if (!prev?.userId) return prev;
        const followers = prev.userId.followers || [];
        const fid = String(user.id);
        const nextFollowers = res.data.following
          ? [...followers.map((f) => f.toString()), fid].filter(
              (v, i, arr) => arr.indexOf(v) === i
            )
          : followers.filter((f) => f.toString() !== fid);
        return {
          ...prev,
          userId: { ...prev.userId, followers: nextFollowers },
        };
      });
    } catch {}
  };

  const handleRemix = async () => {
    if (!user) return navigate("/login");
    setRemixing(true);
    try {
      const res = await api.post(`/projects/${id}/remix`);
      showToast("Branch created! Redirecting to your remix...", "success", "Branched 🔀");
      setTimeout(() => navigate(`/projects/${res.data._id}`), 1200);
    } catch (err) {
      showToast(err.response?.data?.message || "Could not remix", "error", "Branch Failed");
      setRemixing(false);
    }
  };

  const handlePullUpdates = async () => {
    if (!window.confirm("Pull latest changes from the original project?")) return;
    try {
      const res = await api.post(`/projects/${id}/pull`);
      setProject(res.data);
      showToast("Successfully pulled latest changes from the original project!", "success", "Pull Successful ⬇");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to pull updates", "error", "Pull Failed");
    }
  };

  const handlePushToOriginal = async () => {
    setSyncSending(true);
    try {
      await api.post(`/projects/${project.remixedFrom._id || project.remixedFrom}/sync-request`);
      setSyncRequestSent(true);
      showToast("Push successful! Sync request sent to the original creator.", "success", "Pushed ⬆");
    } catch (err) {
      showToast(err.response?.data?.message || "Could not push", "error", "Push Failed");
    } finally {
      setSyncSending(false);
    }
  };

  const handleRequestAccess = async () => {
    if (!user) return navigate("/login");
    try {
      const res = await api.post(`/projects/${id}/req-access`);
      setProject(prev => ({
        ...prev,
        remixAccessRequests: res.data.remixAccessRequests
      }));
      showToast("Access request sent! The project owner will be notified and can approve or decline.", "pending", "Request Sent 🔒");
    } catch (err) {
      showToast(err.response?.data?.message || "Could not request access", "error", "Failed");
    }
  };

  const handleRespondAccess = async (reqId, action) => {
    try {
      const res = await api.post(`/projects/${id}/req-access/${reqId}/respond`, { action });
      setProject(prev => ({
        ...prev,
        remixAccessRequests: res.data.remixAccessRequests,
        allowedRemixers: res.data.allowedRemixers
      }));
      showToast(
        action === "approve" ? "User has been granted remix access to your project." : "Access request declined.",
        action === "approve" ? "success" : "info",
        action === "approve" ? "Access Granted ✅" : "Declined"
      );
    } catch (err) {
      showToast(err.response?.data?.message || "Error responding", "error", "Error");
    }
  };

  const handleRevokeAccess = async (userId) => {
    if (!window.confirm("Revoke this user's access to remix and sync?")) return;
    try {
      const res = await api.delete(`/projects/${id}/revoke-access/${userId}`);
      setProject(prev => ({
        ...prev,
        allowedRemixers: res.data.allowedRemixers
      }));
      showToast("Access revoked. This user can no longer remix or sync this project.", "warning", "Access Revoked");
    } catch (err) {
      showToast(err.response?.data?.message || "Error revoking", "error", "Error");
    }
  };

  const handleTogglePublicRemix = async () => {
    try {
      const res = await api.post(`/projects/${id}/toggle-public-remix`);
      setProject(prev => ({ ...prev, isPublicRemix: res.data.isPublicRemix }));
      showToast(res.data.message, "success", "Setting Updated");
    } catch (err) {
      showToast("Could not update setting", "error", "Error");
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      const res = await api.post(`/projects/${id}/comments`, { text: comment });
      setProject(prev => ({ ...prev, comments: res.data }));
      setComment("");
      showToast("Comment posted!", "success", "Success");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to post comment", "error", "Error");
    }
  };

  const handleLikeComment = async (commentId) => {
    if (!user) return navigate("/login");
    try {
      const res = await api.post(`/projects/${id}/comments/${commentId}/like`);
      setProject(prev => ({ ...prev, comments: res.data }));
    } catch {}
  };

  const handleReplyComment = (username) => {
    setComment(`@${username} `);
    document.querySelector(".comment-input").focus();
  };

  const handleDeleteComment = async (commentId) => {
    await api.delete(`/projects/${id}/comments/${commentId}`);
    setProject(prev => ({ ...prev, comments: prev.comments.filter(c => c._id !== commentId) }));
  };

  const handleDownload = () => {
    window.open(`${api.defaults.baseURL}/projects/${id}/download`);
  };

  if (loading) return <div className="loading">Loading project...</div>;
  if (!project) return <p className="loading">Project not found.</p>;

  const username  = project.userId?.username || "unknown";
  const userId    = project.userId?._id || project.userId;
  const badge     = STATUS_BADGE[project.status] || STATUS_BADGE["idea"];
  const isRemix   = !!project.remixedFrom;

  const isAllowedRemixer = project.allowedRemixers?.some(u => (u._id || u).toString() === user?.id);
  const hasRequestedAccess = project.remixAccessRequests?.some(r => (r.userId?._id || r.userId).toString() === user?.id && r.status === "pending");

  return (
    <div className="detail-page">
      <Toast toasts={toasts} dismiss={dismiss} />
      <div className="detail-main">

        {/* Header */}
        <div className="detail-header">
          <div className="detail-author">
            <Avatar user={project.userId} size={50} className="detail-avatar-main" />
            <div className="detail-author-meta">
              <div className="detail-author-top">
                <Link to={`/profile/${userId}`} className="detail-username">@{username}</Link>
                {!isOwner && (
                  <button
                    type="button"
                    className={`detail-follow-btn ${followingAuthor ? "following" : ""}`}
                    onClick={handleFollowAuthor}
                  >
                    {followingAuthor ? "Following" : "Follow"}
                  </button>
                )}
              </div>
              <p className="detail-date">{new Date(project.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </div>

          <div className="detail-actions">
            <button className="action-btn-p" onClick={handleDownload} title="Download Project as ZIP">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download ZIP</span>
            </button>
            <button className={`action-btn-p upvote-btn ${liked ? "active" : ""}`} onClick={handleLike} title="Upvote this project">
              <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
              <span>Upvote {likes}</span>
            </button>

            {isOwner && (
              <div className="owner-controls">
                <button className="action-btn-outline" onClick={() => navigate(`/projects/${id}/edit`)}>✏️ Edit</button>
                <button className="action-btn-accent" onClick={() => navigate(`/projects/${id}/ide`)}>💻 Web IDE</button>
              </div>
            )}

            {/* Sync button — shown to non-owner who follows creator */}
            {user && !isOwner && (
              <div className="action-wrapper" style={{ display: 'inline-block' }}>
                <button
                  className={`sync-requests-btn ${showSyncPanel ? "active" : ""}`}
                  onClick={handleOpenSyncPanel}
                  title="Contribute changes back to creator"
                >
                  🔄 Sync Request
                </button>
              </div>
            )}

            {/* Contributor Controls — only for owner */}
            {isOwner && (
              <button
                className={`sync-requests-btn ${showControlsPanel ? "active" : ""}`}
                onClick={() => { 
                  setShowControlsPanel(p => !p); 
                  if (!showControlsPanel) handleOpenSyncPanel(); // Pre-fetch sync requests when opening
                }}
              >
                ⚙️ Contributor Controls
              </button>
            )}

            {/* Sync Requests for non-owner Remixers */}
            {!isOwner && isAllowedRemixer && (
              <button
                className={`sync-requests-btn ${showSyncPanel ? "active" : ""}`}
                onClick={handleOpenSyncPanel}
              >
                🔄 Contribute Changes
              </button>
            )}

            {/* Branch / Request Access — shown to all logged-in users except owner */}
            {user && !isOwner && (
              <div className="action-wrapper" style={{ display: 'inline-block' }}>
                {(project.isPublicRemix || isAllowedRemixer) ? (
                  <button 
                    className="remix-btn" 
                    onClick={handleRemix} 
                    disabled={remixing}
                    title="Create your own branch to edit this project"
                  >
                    {remixing ? "Branching..." : "🔁 Request Remix"}
                  </button>
                ) : (
                  <RemixRequestButton 
                    projectId={project._id} 
                    initialStatus={hasRequestedAccess ? 'pending' : 'idle'} 
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Collaboration Hub Terminal */}
        <CollaborationHub 
          project={project}
          user={user}
          onPull={handlePullUpdates}
          onPush={handlePushToOriginal}
          isOwner={isOwner}
          syncSending={syncSending}
          syncRequestSent={syncRequestSent}
        />

        {/* ── Owner Controls Panel ── */}
        {showControlsPanel && isOwner && (
          <div className="sync-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="sync-panel-header" style={{ margin: 0, padding: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', width: '100%' }}>
                <button 
                  style={{ flex: 1, padding: "14px 0", background: activeControlTab === "remixRequests" ? "rgba(59, 130, 246, 0.1)" : "transparent", border: "none", borderBottom: activeControlTab === "remixRequests" ? "2px solid #3b82f6" : "2px solid transparent", color: activeControlTab === "remixRequests" ? "#fff" : "#888", fontWeight: "bold", cursor: "pointer", transition: "0.2s" }}
                  onClick={() => setActiveControlTab("remixRequests")}
                >
                  Remix Requests
                </button>
                <button 
                  style={{ flex: 1, padding: "14px 0", background: activeControlTab === "syncRequests" ? "rgba(59, 130, 246, 0.1)" : "transparent", border: "none", borderBottom: activeControlTab === "syncRequests" ? "2px solid #3b82f6" : "2px solid transparent", color: activeControlTab === "syncRequests" ? "#fff" : "#888", fontWeight: "bold", cursor: "pointer", transition: "0.2s" }}
                  onClick={() => setActiveControlTab("syncRequests")}
                >
                  Code Syncs
                </button>
                <button 
                  style={{ flex: 1, padding: "14px 0", background: activeControlTab === "settings" ? "rgba(59, 130, 246, 0.1)" : "transparent", border: "none", borderBottom: activeControlTab === "settings" ? "2px solid #3b82f6" : "2px solid transparent", color: activeControlTab === "settings" ? "#fff" : "#888", fontWeight: "bold", cursor: "pointer", transition: "0.2s" }}
                  onClick={() => setActiveControlTab("settings")}
                >
                  Settings
                </button>
              </div>
              <button className="sync-panel-close" style={{ position: 'absolute', right: '12px', top: '12px' }} onClick={() => setShowControlsPanel(false)}>✕</button>
            </div>

            <div style={{ padding: "1.5rem" }}>
              {activeControlTab === 'remixRequests' && (
                <div className="access-section" style={{ border: "none", padding: 0, margin: 0 }}>
                  <AdminRemixRequests projectId={project._id} />
                </div>
              )}

              {activeControlTab === 'syncRequests' && (
                <div className="access-section" style={{ border: "none", padding: 0, margin: 0 }}>
                  <h4 style={{ margin: "0 0 1rem 0", fontSize: "0.95rem", color: "var(--text)" }}>Pending Code Integrations</h4>
                  {syncLoading ? (
                    <p className="sync-panel-empty">Loading...</p>
                  ) : syncRequests.length === 0 ? (
                    <p className="sync-panel-empty">No sync requests made yet</p>
                  ) : (
                    <div className="sync-request-list">
                      {syncRequests.map(req => (
                        <div key={req._id} className="sync-request-item" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", padding: "12px", borderRadius: "8px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <AvatarWrapper user={req.requestedBy} size={36} />
                            <div className="sync-info">
                              <p className="sync-text" style={{ margin: 0, fontSize: "0.85rem", color: "#ccc" }}>
                                <Link to={`/profile/${req.requestedBy?._id}`} className="sync-user" style={{ fontWeight: "bold", color: "#fff", textDecoration: "none" }}>
                                  @{req.requestedBy?.username}
                                </Link>
                                <span style={{ marginLeft: "6px" }}>wants to sync</span> {req.remixId?.title || "remix"}
                              </p>
                            </div>
                          </div>
                          <div className="sync-request-actions" style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="sr-approve-btn"
                              style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "0.8rem", border: "none", fontWeight: "bold" }}
                              disabled={respondingId === req._id}
                              onClick={() => handleRespond(req._id, "approve")}
                            >
                              {respondingId === req._id ? "..." : "Approve"}
                            </button>
                            <button
                              className="sr-decline-btn"
                              style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "0.8rem", border: "none", fontWeight: "bold" }}
                              disabled={respondingId === req._id}
                              onClick={() => handleRespond(req._id, "decline")}
                            >
                              {respondingId === req._id ? "..." : "Decline"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeControlTab === 'settings' && (
                <div className="access-section" style={{ border: "none", padding: 0, margin: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: "1.5rem" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--text)" }}>Public Branching</h4>
                      <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#a0a0a0" }}>Allow anyone to branch this project without approval</p>
                    </div>
                    <button 
                      className={`sr-approve-btn ${project.isPublicRemix ? "" : "decline"}`} 
                      onClick={handleTogglePublicRemix}
                      style={{ width: "90px", fontSize: "0.8rem", padding: "8px", border: "none", borderRadius: "6px", fontWeight: "bold" }}
                    >
                      {project.isPublicRemix ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                  
                  <h4 style={{ margin: "0 0 1rem 0", fontSize: "0.95rem", color: "var(--text)" }}>Allowed Collaborators</h4>
                  {project.allowedRemixers?.length === 0 ? (
                    <p className="sync-panel-empty">No external collaborators yet</p>
                  ) : (
                    <div className="sync-request-list" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {project.allowedRemixers?.map(userObj => (
                        <div key={userObj._id} className="sync-request-item" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", padding: "12px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <AvatarWrapper user={userObj} size={36} />
                            <span className="sync-request-text" style={{ fontWeight: "bold", color: "#fff", fontSize: "0.9rem" }}>
                              @{userObj.username || "unknown"}
                            </span>
                          </div>
                          <button 
                            className="sr-decline-btn" 
                            style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "0.8rem", border: "none", fontWeight: "bold", background: "#ef4444" }} 
                            onClick={() => handleRevokeAccess(userObj._id)}
                          >
                            Revoke Access
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Collaboration Hub (Pull / Push) for Remix Owners ── */}
        {isOwner && isRemix && (
          <div className="collaboration-hub">
            <h3 className="hub-title">🔄 Version Control (Sync & Remix)</h3>
            <p className="hub-desc">This project is a branch (remix). You can pull the latest changes from the original creator, or push your own updates back to them.</p>
            <div className="hub-actions">
              <button className="hub-btn pull-btn" onClick={handlePullUpdates}>
                ⬇ Pull (Update from Original)
              </button>
              <button className="hub-btn push-btn" onClick={handlePushToOriginal} disabled={syncSending}>
                {syncSending ? "Pushing..." : "⬆ Push (Sync Request to Original)"}
              </button>
            </div>
            {syncRequestSent && <p className="hub-success">✓ Push successful! Sync request sent to the original creator.</p>}
          </div>
        )}

        {/* ── Sync Panel ── */}
        {showSyncPanel && (
          <div className="sync-panel">
            {/* OWNER VIEW WAS MOVED TO CONTROLS PANEL */}

            {/* REMIXER / NON-OWNER VIEW */}
            {!isOwner && (
              <>
                <div className="sync-panel-header">
                  <span className="sync-panel-title">Contribute Changes</span>
                  <button className="sync-panel-close" onClick={() => setShowSyncPanel(false)}>✕</button>
                </div>
                
                {/* Step guide */}
                {!isAllowedRemixer && !syncRequestSent && (
                  <div className="sync-confirm">
                    <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>How to contribute to this project:</p>
                    <ol style={{ paddingLeft: "1.2rem", lineHeight: 1.8, fontSize: "0.85rem" }}>
                      <li>Click <strong>🔒 Request Remix Access</strong> (button in header)</li>
                      <li>Wait for the owner to approve your request</li>
                      <li>Once approved, click <strong>🔀 Branch (Remix)</strong> to get your own copy</li>
                      <li>Edit your branch, then return here to <strong>⬆ Send Sync Request</strong></li>
                    </ol>
                    {hasRequestedAccess && (
                      <p style={{ marginTop: "0.75rem", color: "#f59e0b", fontSize: "0.83rem", fontWeight: 600 }}>
                        ⏳ Your access request is pending. Wait for owner approval.
                      </p>
                    )}
                  </div>
                )}

                {isAllowedRemixer && (
                  syncRequestSent ? (
                    <p className="sync-panel-sent">✓ Sync request sent! The original creator will review your changes.</p>
                  ) : showSendConfirm ? (
                    <div className="sync-confirm">
                      <p>Send your changes to <strong>@{username}</strong>'s project?</p>
                      <p className="sync-confirm-sub">If they approve, your edits will be merged into the original project.</p>
                      <div className="sync-confirm-actions">
                        <button className="sr-approve-btn" onClick={handleSendSyncRequest} disabled={syncSending}>
                          {syncSending ? "Sending..." : "Send"}
                        </button>
                        <button className="sr-decline-btn" onClick={() => setShowSendConfirm(false)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="sync-confirm">
                      <p>✅ You have remix access. Contribute your changes back to the original project.</p>
                      <button className="sr-approve-btn" onClick={() => setShowSendConfirm(true)}>
                        ⬆ Send Sync Request
                      </button>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        )}

        <div className="detail-body">
          <div className="detail-title-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="detail-title">{project.title}</h1>
            <span className={`status-badge status-badge-lg ${badge.cls}`}>{badge.icon} {badge.label}</span>
            {isRemix && (
              <span className="sync-state-badge" style={{ background: "rgba(39,201,63,0.1)", color: "#27c93f", padding: "6px 12px", borderRadius: "100px", fontSize: "0.85rem", fontWeight: "bold", border: "1px solid #27c93f" }}>
                🟢 Up to Date
              </span>
            )}
          </div>

          {project.remixedFrom && (
            <div className="remix-source-bar" style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.2)", padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border)", width: "fit-content", marginBottom: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", opacity: 0.6, textTransform: "uppercase", letterSpacing: "1px" }}>Original Project</span>
                <Link to={`/projects/${project.remixedFrom._id || project.remixedFrom}`} style={{ fontWeight: "bold", color: "var(--text)" }}>
                  {project.remixedFrom.title || "Unknown"}
                </Link>
              </div>
              
              <span style={{ color: "var(--text-muted)", fontSize: "1.2rem", margin: "0 8px" }}>⬇</span>
              
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", opacity: 0.6, textTransform: "uppercase", letterSpacing: "1px" }}>Your Remix</span>
                <span style={{ fontWeight: "bold", color: "var(--accent)" }}>{project.title}</span>
              </div>
              
              <span style={{ color: "var(--text-muted)", fontSize: "1.2rem", margin: "0 8px" }}>↓</span>
              
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", opacity: 0.6, textTransform: "uppercase", letterSpacing: "1px" }}>Collaboration</span>
                <span style={{ fontWeight: "bold", color: "#27c93f" }}>Merge Requests</span>
              </div>
            </div>
          )}

          {project.tags?.length > 0 && (
            <div className="detail-tags">
              {project.tags.map(tag => (
                <span key={tag} className="tag clickable-tag" onClick={() => navigate(`/?tag=${encodeURIComponent(tag)}`)}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <p className="detail-desc">{project.description}</p>

          {(project.about?.features || project.about?.howItWorks || project.about?.futurePlans) && (
            <div className="detail-section about-block">
              <h3>📋 About This Project</h3>
              {project.about.features && (
                <div className="about-item">
                  <span className="about-label">✨ Features</span>
                  <p>{project.about.features}</p>
                </div>
              )}
              {project.about.howItWorks && (
                <div className="about-item">
                  <span className="about-label">⚙️ How it works</span>
                  <p>{project.about.howItWorks}</p>
                </div>
              )}
              {project.about.futurePlans && (
                <div className="about-item">
                  <span className="about-label">🚀 Future plans</span>
                  <p>{project.about.futurePlans}</p>
                </div>
              )}
            </div>
          )}

          {project.codeSnippet && (
            <div className="detail-section">
              <h3>Code Snippet</h3>
              <pre className="detail-snippet">{project.codeSnippet}</pre>
            </div>
          )}

          {project.files?.length > 0 && (
            <div className="detail-section">
              <h3>📁 Files ({project.files.length})</h3>
              <div className="file-viewer-list">
                {project.files.map((file, i) => <FileViewer key={i} file={file} />)}
              </div>
            </div>
          )}

          <div className="detail-section">
            <h3 className="comments-heading">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Discussion ({project.comments?.length || 0})
            </h3>
            {user && (
              <form onSubmit={handleComment} className="comment-form">
                <input className="comment-input" placeholder="Add a comment..." value={comment} onChange={e => setComment(e.target.value)} />
                <button type="submit">Post</button>
              </form>
            )}
            <div className="comments-list">
              {project.comments?.length === 0 && <p className="no-comments">No comments yet. Be the first!</p>}
              {project.comments?.map(c => {
                const isLiked = user && c.likes?.map(l=>l.toString()).includes(user.id);
                return (
                <div key={c._id} className="comment-item">
                  <div className="comment-top">
                    <Link to={`/profile/${c.userId?._id}`} className="comment-user">@{c.userId?.username || "unknown"}</Link>
                    <span className="comment-date">{new Date(c.createdAt).toLocaleDateString()}</span>
                    {user && user.id === c.userId?._id?.toString() && (
                      <button className="delete-comment-btn" onClick={() => handleDeleteComment(c._id)}>✕</button>
                    )}
                  </div>
                  <p className="comment-text">{c.text}</p>
                  <div className="comment-actions">
                    <button className={`comment-action-btn ${isLiked ? 'liked' : ''}`} onClick={() => handleLikeComment(c._id)}>
                      {isLiked ? '❤️' : '🤍'} {c.likes?.length || 0}
                    </button>
                    <button className="comment-action-btn" onClick={() => handleReplyComment(c.userId?.username || "unknown")}>
                      ↩ Reply
                    </button>
                  </div>
                </div>
              )})}
            </div>
          </div>

          {project.syncHistory?.length > 0 && (
            <div className="detail-section">
              <h3>📋 Activity Timeline</h3>
              <div className="sync-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {project.syncHistory.map(entry => (
                  <div key={entry._id} className="sync-history-item" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary, #1e1e1e)', padding: '16px', borderRadius: '10px', border: "1px solid var(--border)" }}>
                    <div style={{ background: "rgba(39,201,63,0.15)", color: "#27c93f", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ✔
                    </div>
                    <Avatar user={entry.contributorId} size={36} />
                    <div className="sync-info" style={{ flex: 1 }}>
                      <p className="sync-text" style={{ margin: 0 }}>
                        <Link to={`/profile/${entry.contributorId?._id}`} className="sync-user" style={{ fontWeight: "bold" }}>
                          @{entry.contributorId?.username}
                        </Link>
                        {" "}merged updates (version {entry.versionNumber})
                      </p>
                      <span className="sync-date" style={{ fontSize: "0.85rem", opacity: 0.6 }}>{new Date(entry.approvedAt).toLocaleDateString()}</span>
                    </div>
                    <span style={{ padding: "4px 10px", background: "rgba(39,201,63,0.2)", color: "#27c93f", borderRadius: "100px", fontSize: "0.75rem", fontWeight: "bold" }}>Approved</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {project.versions?.length > 0 && (
            <div className="detail-section">
              <h3>🕓 Version History ({project.versions.length + 1} versions)</h3>
              <div className="version-list">
                <div className={`version-item current ${activeVersion === null ? "active" : ""}`} onClick={() => setActiveVersion(null)}>
                  <div className="version-meta">
                    <span className="version-badge">v{project.currentVersion} · Latest</span>
                    <span className="version-date">{new Date(project.updatedAt || project.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="version-title">{project.title}</p>
                </div>
                {[...project.versions].reverse().map(v => (
                  <div
                    key={v.versionNumber}
                    className={`version-item ${activeVersion?.versionNumber === v.versionNumber ? "active" : ""}`}
                    onClick={() => setActiveVersion(prev => prev?.versionNumber === v.versionNumber ? null : v)}
                  >
                    <div className="version-meta">
                      <span className="version-badge">v{v.versionNumber}</span>
                      <span className="version-date">{new Date(v.editedAt).toLocaleString()}</span>
                    </div>
                    <p className="version-title">{v.title}</p>
                    {activeVersion?.versionNumber === v.versionNumber && (
                      <div className="version-preview">
                        <p className="version-desc">{v.description}</p>
                        {v.codeSnippet && <pre className="version-snippet">{v.codeSnippet}</pre>}
                        {(v.about?.features || v.about?.howItWorks || v.about?.futurePlans) && (
                          <div className="version-about">
                            {v.about.features    && <p><strong>✨ Features:</strong> {v.about.features}</p>}
                            {v.about.howItWorks  && <p><strong>⚙️ How it works:</strong> {v.about.howItWorks}</p>}
                            {v.about.futurePlans && <p><strong>🚀 Future plans:</strong> {v.about.futurePlans}</p>}
                          </div>
                        )}
                        {v.tags?.length > 0 && (
                          <div className="version-tags">
                            {v.tags.map(t => <span key={t} className="tag">#{t}</span>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
