import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import ProjectCard from "../components/ProjectCard";
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

  useEffect(() => {
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
          {profile.avatar ? (
            <img src={`${AVATAR_BASE}${profile.avatar}`} alt="avatar" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar-placeholder">{profile.username[0].toUpperCase()}</div>
          )}
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
                  className="follow-btn"
                  style={{ background: "var(--bg-secondary, #f1f5f9)", color: "var(--text)", border: "1px solid var(--border-soft)" }}
                  onClick={() => window.dispatchEvent(new CustomEvent("vibe:open-chat", { detail: { userId: id, user: profile } }))}
                >
                  💬 Message
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
            <span className="vibe-label">⚡ Vibe Score</span>
            <div className="vibe-bar-track">
              <div className="vibe-bar-fill" style={{ width: `${score}%` }} />
            </div>
            <span className="vibe-number">{score}</span>
          </div>
        </div>
      </div>

      {/* Layout toggle + grid */}
      <div className="profile-projects-header">
        <span className="projects-label">Projects</span>
        <div className="layout-toggle">
          <button className={localLayout === "grid" ? "active" : ""} onClick={() => setLocalLayout("grid")}>⊞</button>
          <button className={localLayout === "list" ? "active" : ""} onClick={() => setLocalLayout("list")}>☰</button>
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="empty">No projects yet.</p>
      ) : (
        <div className={localLayout === "grid" ? "profile-grid" : "profile-list"}>
          {projects.map(p => (
            <ProjectCard key={p._id} project={p} tile={localLayout === "grid"} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
