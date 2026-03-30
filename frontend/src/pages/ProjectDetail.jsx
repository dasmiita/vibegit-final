import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Toast, { useToast } from "../components/Toast";
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

function Avatar({ user, size = 32 }) {
  const url = user?.avatar ? `${BASE}${user.avatar}` : null;
  const letter = (user?.username || "?")[0].toUpperCase();
  if (url) return <img src={url} alt="" className="sr-avatar-img" style={{ width: size, height: size }} />;
  return <div className="sr-avatar-placeholder" style={{ width: size, height: size, fontSize: size * 0.38 }}>{letter}</div>;
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

  // Sync / Access panel state
  const [showSyncPanel, setShowSyncPanel]       = useState(false);
  const [showAccessPanel, setShowAccessPanel]   = useState(false);
  const [syncRequests, setSyncRequests]         = useState([]);
  const [syncLoading, setSyncLoading]           = useState(false);
  const [respondingId, setRespondingId]         = useState(null);
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
    const res = await api.post(`/projects/${id}/like`);
    setLikes(res.data.likes);
    setLiked(res.data.liked);
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

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const res = await api.post(`/projects/${id}/comments`, { text: comment });
    setProject(prev => ({ ...prev, comments: res.data }));
    setComment("");
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

  if (loading) return <p className="loading">Loading project...</p>;
  if (!project) return <p className="loading">Project not found.</p>;

  const username  = project.userId?.username || "unknown";
  const userId    = project.userId?._id || project.userId;
  const avatarUrl = project.userId?.avatar ? `${BASE}${project.userId.avatar}` : null;
  const badge     = STATUS_BADGE[project.status] || STATUS_BADGE["idea"];
  const isRemix   = !!project.remixedFrom;
  const originalOwnerUsername = project.remixedFrom?.userId?.username;

  const isAllowedRemixer = project.allowedRemixers?.some(u => (u._id || u).toString() === user?.id);
  const hasRequestedAccess = project.remixAccessRequests?.some(r => (r.userId?._id || r.userId).toString() === user?.id && r.status === "pending");

  return (
    <div className="detail-page">
      <Toast toasts={toasts} dismiss={dismiss} />
      <div className="detail-main">

        {/* Header */}
        <div className="detail-header">
          <div className="detail-author">
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="detail-avatar" />
              : <div className="detail-avatar-placeholder">{username[0].toUpperCase()}</div>
            }
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
            <span className={`status-badge ${badge.cls}`}>{badge.icon} {badge.label}</span>
            <button className={`like-btn-lg ${liked ? "liked" : ""}`} onClick={handleLike}>⬆ Upvote {likes}</button>

            {isOwner && (
              <>
                <button className="edit-project-btn" onClick={() => navigate(`/projects/${id}/edit`)}>✏️ Edit</button>
                <button className="edit-project-btn" onClick={() => navigate(`/projects/${id}/ide`)} style={{ marginLeft: "0.5rem", background: "var(--accent-dim)", color: "var(--accent)" }}>💻 Web IDE</button>
              </>
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

            {/* Sync Requests inbox — only for owner */}
            {isOwner && (
              <button
                className={`sync-requests-btn ${showSyncPanel ? "active" : ""}`}
                onClick={handleOpenSyncPanel}
              >
                🔄 Sync Requests
              </button>
            )}

            {/* Access Control — only for owner */}
            {isOwner && (
              <button
                className={`sync-requests-btn ${showAccessPanel ? "active" : ""}`}
                onClick={() => { setShowAccessPanel(p => !p); setShowSyncPanel(false); }}
              >
                ⚙️ Access Control
              </button>
            )}

            {/* Branch / Request Access — shown to all logged-in users except owner (owner already has Branch above) */}
            {user && !isOwner && (
              <div className="action-wrapper" style={{ display: 'inline-block' }}>
                {isAllowedRemixer ? (
                  <button 
                    className="remix-btn" 
                    onClick={handleRemix} 
                    disabled={remixing}
                    title="Create your own branch to edit this project"
                  >
                    {remixing ? "Branching..." : "🔀 Branch (Remix)"}
                  </button>
                ) : hasRequestedAccess ? (
                  <button className="remix-btn" disabled>
                    ⏳ Pending Approval
                  </button>
                ) : (
                  <button 
                    className="remix-btn" 
                    onClick={handleRequestAccess}
                    title="Ask the creator for permission to branch this project"
                  >
                    🔒 Request Remix Access
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Access Control Panel ── */}
        {showAccessPanel && isOwner && (
          <div className="sync-panel">
            <div className="sync-panel-header">
              <span className="sync-panel-title">Project Access Control</span>
              <button className="sync-panel-close" onClick={() => setShowAccessPanel(false)}>✕</button>
            </div>
            
            <div className="access-section">
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--text)" }}>Pending Requests</h4>
              {project.remixAccessRequests?.filter(r => r.status === "pending").length === 0 ? (
                <p className="sync-panel-empty">No pending requests</p>
              ) : (
                <div className="sync-request-list">
                  {project.remixAccessRequests?.filter(r => r.status === "pending").map(req => (
                    <div key={req._id} className="sync-request-item">
                      <Avatar user={req.userId} size={32} />
                      <span className="sync-request-text">
                        <strong>@{req.userId?.username || "unknown"}</strong> wants to remix this project
                      </span>
                      <div className="sync-request-actions">
                        <button className="sr-approve-btn" onClick={() => handleRespondAccess(req._id, "approve")}>✓ Approve</button>
                        <button className="sr-decline-btn" onClick={() => handleRespondAccess(req._id, "decline")}>✕ Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="access-section" style={{ marginTop: "1.5rem" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--text)" }}>Allowed Collaborators</h4>
              {project.allowedRemixers?.length === 0 ? (
                <p className="sync-panel-empty">No external collaborators yet</p>
              ) : (
                <div className="sync-request-list">
                  {project.allowedRemixers?.map(userObj => (
                    <div key={userObj._id} className="sync-request-item">
                      <Avatar user={userObj} size={32} />
                      <span className="sync-request-text">
                        <strong>@{userObj.username || "unknown"}</strong>
                      </span>
                      <div className="sync-request-actions">
                        <button className="sr-decline-btn" onClick={() => handleRevokeAccess(userObj._id)}>Revoke Access</button>
                      </div>
                    </div>
                  ))}
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
            {/* OWNER VIEW */}
            {isOwner && (
              <>
                <div className="sync-panel-header">
                  <span className="sync-panel-title">Incoming Sync Requests</span>
                  <button className="sync-panel-close" onClick={() => setShowSyncPanel(false)}>✕</button>
                </div>
                {syncLoading ? (
                  <p className="sync-panel-empty">Loading...</p>
                ) : syncRequests.length === 0 ? (
                  <p className="sync-panel-empty">No requests made</p>
                ) : (
                  <div className="sync-request-list">
                    {syncRequests.map(req => (
                      <div key={req._id} className="sync-request-item">
                        <Avatar user={req.requestedBy} size={32} />
                        <span className="sync-request-text">
                          <strong>@{req.requestedBy?.username || "unknown"}</strong> wants to sync their changes into your project
                        </span>
                        <div className="sync-request-actions">
                          <button
                            className="sr-approve-btn"
                            disabled={respondingId === req._id}
                            onClick={() => handleRespond(req._id, "approve")}
                          >
                            {respondingId === req._id ? "..." : "✓ Approve"}
                          </button>
                          <button
                            className="sr-decline-btn"
                            disabled={respondingId === req._id}
                            onClick={() => handleRespond(req._id, "decline")}
                          >
                            {respondingId === req._id ? "..." : "✕ Decline"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

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
          <h1 className="detail-title">{project.title}</h1>

          {project.remixedFrom && (
            <p className="detail-remix-label">
              🔀 Remixed from{" "}
              <Link to={`/projects/${project.remixedFrom._id}`} className="remix-source-link">
                {project.remixedFrom.title || "a project"}
              </Link>
            </p>
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
            <h3>💬 Comments ({project.comments?.length || 0})</h3>
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
              <h3>🤝 Pull Requests Merged ({project.syncHistory.length})</h3>
              <div className="sync-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {project.syncHistory.map(sh => (
                  <div key={sh._id} className="sync-history-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-secondary, #f8f9fa)', padding: '10px', borderRadius: '8px' }}>
                    <Avatar user={sh.contributorId} size={28} />
                    <span>
                      <Link to={`/profile/${sh.contributorId?._id}`} style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                        @{sh.contributorId?.username || "unknown"}
                      </Link>
                      {" "}contributed changes in <strong>v{sh.versionNumber}</strong> on {new Date(sh.approvedAt).toLocaleDateString()}
                    </span>
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
