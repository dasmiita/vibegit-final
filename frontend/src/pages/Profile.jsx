import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import ProjectCard from "../components/ProjectCard";
import Avatar from "../components/Avatar";
import "./Profile.css";

const AVATAR_BASE = "http://localhost:5000/uploads/";

function vibeScore(projectCount, followerCount, totalLikes) {
  return Math.min(100, Math.floor(projectCount * 5 + followerCount * 3 + totalLikes * 1));
}

export default function Profile({ openChat }) {
  const { id } = useParams();
  const { user } = useAuth();
  const { layout } = useTheme();
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [localLayout, setLocalLayout] = useState(layout);
  const [activeTab, setActiveTab] = useState("projects"); // "projects" or "drafts"
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    // Check for draft if it's own profile
    if (user && user.id === id) {
      const saved = localStorage.getItem("vibe:project_draft");
      if (saved) setDraft(JSON.parse(saved));
    }
    
    Promise.all([
      api.get(`/users/${id}`),
      api.get(`/users/${id}/projects`)
    ]).then(([userRes, projRes]) => {
      setProfile(userRes.data);
      setProjects(projRes.data);
      setFollowerCount(userRes.data.followers?.length || 0);
      setFollowing(user ? userRes.data.followers?.map(f => f.toString()).includes(user.id) : false);
    }).finally(() => setLoading(false));
  }, [id, user]);

  const handleFollow = async () => {
    if (!user) return;
    const res = await api.post(`/users/${id}/follow`);
    setFollowing(res.data.following);
    setFollowerCount(res.data.followerCount);
  };

  const handleDelete = (deletedId) => setProjects(prev => prev.filter(p => p._id !== deletedId));

  if (loading) return <p className="loading">Loading profile...</p>;
  if (!profile) return <p className="loading">User not found.</p>;

  const isOwnProfile = user && user.id === id;
  const totalLikes = projects.reduce((sum, p) => sum + (p.likes?.length || 0), 0);
  const score = vibeScore(profile.projectCount, followerCount, totalLikes);

  return (
    <div className="profile-page">
      {/* Instagram-style header */}
      <div className="profile-header">
        <div className="profile-left">
          <Avatar user={profile} size={140} />
        </div>

        <div className="profile-right">
          <div className="profile-top-row">
            <h2 className="profile-username">@{profile.username}</h2>
            {isOwnProfile ? (
              <Link to={`/profile/${id}/edit`} className="edit-profile-btn">Edit Profile</Link>
            ) : user && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button className={`follow-btn ${following ? "following" : ""}`} onClick={handleFollow}>
                  {following ? "Following" : "Follow"}
                </button>
                <button 
                  className="msg-profile-btn"
                  onClick={() => window.dispatchEvent(new CustomEvent("vibe:open-chat", { detail: { userId: id, user: profile } }))}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  Message
                </button>
              </div>
            )}
          </div>

          <div className="profile-stats">
            <div className="stat"><strong>{profile.projectCount}</strong><span>projects</span></div>
            <div className="stat"><strong>{followerCount}</strong><span>followers</span></div>
            <div className="stat"><strong>{profile.following?.length || 0}</strong><span>following</span></div>
          </div>

          {profile.bio && <p className="profile-bio">{profile.bio}</p>}

          {profile.skills?.length > 0 && (
            <div className="profile-skills">
              {profile.skills.map(s => <span key={s} className="skill-tag">{s}</span>)}
            </div>
          )}

          <div className="vibe-score">
            <span className="vibe-label">
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ width: 14, height: 14 }}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Vibe Score
            </span>
            <div className="vibe-bar-track">
              <div className="vibe-bar-fill" style={{ width: `${score}%` }} />
            </div>
            <span className="vibe-number">{score}</span>
          </div>
        </div>
      </div>

      {/* Layout toggle + grid */}
      <div className="profile-projects-header">
        <div className="profile-tabs">
          <button 
            className={`tab-btn ${activeTab === "projects" ? "active" : ""}`} 
            onClick={() => setActiveTab("projects")}
          >
            Projects
          </button>
          {isOwnProfile && (
            <button 
              className={`tab-btn ${activeTab === "drafts" ? "active" : ""}`} 
              onClick={() => setActiveTab("drafts")}
            >
              Drafts {draft && <span className="draft-dot" />}
            </button>
          )}
        </div>
        <div className="layout-toggle">
          <button className={localLayout === "grid" ? "active" : ""} onClick={() => setLocalLayout("grid")} title="Grid View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
          <button className={localLayout === "list" ? "active" : ""} onClick={() => setLocalLayout("list")} title="List View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {activeTab === "projects" ? (
        projects.length === 0 ? (
          <p className="empty">No projects yet.</p>
        ) : (
          <div className={localLayout === "grid" ? "profile-grid" : "profile-list"}>
            {projects.map(p => (
              <ProjectCard key={p._id} project={p} tile={localLayout === "grid"} onDelete={handleDelete} />
            ))}
          </div>
        )
      ) : (
        /* Drafts View */
        <div className="drafts-view">
          {!draft ? (
            <p className="empty">No saved drafts.</p>
          ) : (
            <div className="draft-card">
              <div className="draft-info">
                <h3>{draft.form?.title || "Untitled Project"}</h3>
                <p>{draft.form?.description || "No description provided."}</p>
                <div className="draft-meta">
                  {draft.domain && <span className="tag">#{draft.domain}</span>}
                  <span className="draft-date">Last edited locally</span>
                </div>
              </div>
              <Link to="/create" className="edit-draft-btn">Continue Editing</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
