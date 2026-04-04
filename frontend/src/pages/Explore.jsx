import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import Avatar from "../components/Avatar";
import NightSky from "../components/NightSky";
import { useTheme } from "../context/ThemeContext";
import "./Explore.css";

const TAGS = ["AI", "Web", "Mobile", "Fun", "Design", "Game", "Tool", "Other"];

export default function Explore() {
  const [activeTab, setActiveTab] = useState("projects"); // 'projects' or 'profiles'
  const [projects, setProjects] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const search = params.get("search") || "";
  const tag = params.get("tag") || "";

  useEffect(() => {
    fetchData();
  }, [search, tag, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "projects") {
        const query = new URLSearchParams();
        if (search) query.set("search", search);
        if (tag) query.set("tag", tag);
        const res = await api.get(`/projects?${query.toString()}`);
        setProjects(res.data);
      } else {
        const res = await api.get("/users");
        setProfiles(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch explore data:", err);
    } finally {
      setLoading(false);
    }
  };

  const setTag = (t) => {
    const q = new URLSearchParams(location.search);
    if (q.get("tag") === t) q.delete("tag");
    else q.set("tag", t);
    navigate(`?${q.toString()}`);
  };

  const handleLike = async (e, projectId) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/projects/${projectId}/like`);
      setProjects(prev => prev.map(p => 
        p._id === projectId ? { ...p, likes: new Array(res.data.likes).fill(0), liked: res.data.liked } : p
      ));
    } catch (err) {
      if (err.response?.status === 401) navigate("/login");
    }
  };

  return (
    <div className="explore-page">
      <NightSky />
      {/* Hero Section */}
      <div className="ex-hero">
        <div className="ex-hero-content">
          <h1 className="ex-hero-title">
            {search ? <>Results for <em>"{search}"</em></> : <>Explore the <em>Future</em></>}
          </h1>
          <p className="ex-hero-sub">
            Discover premium projects and top creators in the VibeGit ecosystem.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          className="ex-tab-switcher"
          style={{
            background: isDark ? "#27272a" : "#ffffff",
            border: isDark ? "1px solid #52525b" : "1px solid #e4e4e7",
            boxShadow: isDark ? "0 2px 16px rgba(0,0,0,0.9)" : "0 2px 8px rgba(0,0,0,0.1)",
            position: "relative",
            zIndex: 10,
          }}
        >
          <button
            className={`ex-tab ${activeTab === "projects" ? "active" : ""}`}
            onClick={() => setActiveTab("projects")}
            style={{ color: activeTab === "projects" ? "#fff" : (isDark ? "#e4e4e7" : "#71717a"), background: activeTab === "projects" ? "var(--accent)" : "transparent" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Projects
            {projects.length > 0 && activeTab === "projects" && <span className="ex-tab-pill">{projects.length}</span>}
          </button>
          <button
            className={`ex-tab ${activeTab === "profiles" ? "active" : ""}`}
            onClick={() => setActiveTab("profiles")}
            style={{ color: activeTab === "profiles" ? "#fff" : (isDark ? "#e4e4e7" : "#71717a"), background: activeTab === "profiles" ? "var(--accent)" : "transparent" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Top Vibes
            {profiles.length > 0 && activeTab === "profiles" && <span className="ex-tab-pill">{profiles.length}</span>}
          </button>
        </div>
      </div>

      {/* Tag Bar */}
      <div className="ex-tag-bar">
        {TAGS.map(t => (
          <button
            key={t}
            className={`ex-tag-btn ${tag === t ? "active" : ""}`}
            onClick={() => setTag(t)}
          >
            #{t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={activeTab === "projects" ? "ex-proj-grid" : "ex-prof-grid"}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className={`ex-skeleton ${activeTab === "profiles" ? "ex-skeleton-prof" : ""}`}>
              <div className="skel-line skel-avatar" />
              <div className="skel-line skel-title" />
              <div className="skel-line skel-body" />
              <div className="skel-line skel-body short" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {activeTab === "projects" ? (
            projects.length === 0 ? (
              <div className="ex-empty">
                <span className="ex-empty-icon">📂</span>
                <p>No projects found matching your criteria.</p>
                <button className="ex-empty-cta" onClick={() => navigate("/create")}>Create Project</button>
              </div>
            ) : (
              <div className="ex-proj-grid">
                {projects.map(p => (
                  <ProjectCardSmall key={p._id} project={p} onLike={(e) => handleLike(e, p._id)} />
                ))}
              </div>
            )
          ) : (
            profiles.length === 0 ? (
              <div className="ex-empty">
                <span className="ex-empty-icon">👥</span>
                <p>No creators found yet. Be the first!</p>
              </div>
            ) : (
              <div className="ex-prof-grid">
                {profiles.map(u => (
                  <ProfileCard key={u._id} user={u} />
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

function ProjectCardSmall({ project, onLike }) {
  const navigate = useNavigate();
  const liked = project.liked;

  return (
    <div className="ex-proj-card" onClick={() => navigate(`/projects/${project._id}`)}>
      
      <div className="ex-proj-header">
        <Link to={`/profile/${project.userId?._id}`} className="ex-proj-author" onClick={e => e.stopPropagation()}>
          <Avatar user={project.userId} size={20} />
          <span className="ex-proj-username">@{project.userId?.username}</span>
        </Link>
        <span className={`ex-proj-status-badge status-${project.status}`}>
          {project.status === "completed" ? "✅" : project.status === "in-progress" ? "🚧" : "💡"} {project.status}
        </span>
      </div>

      <h3 className="ex-proj-title">{project.title}</h3>
      <p className="ex-proj-desc">{project.description}</p>

      <div className="ex-proj-tags">
        {project.tags?.slice(0, 3).map(t => (
          <span key={t} className="ex-proj-tag">#{t}</span>
        ))}
      </div>

      <div className="ex-proj-footer">
        <button className={`ex-like-btn ${liked ? "liked" : ""}`} onClick={onLike}>
          <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" style={{ width: 13, height: 13 }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {project.likes?.length || 0}
        </button>
        <div className="ex-proj-meta">
          <span className="ex-remix-count">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 11, height: 11 }}>
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            {project.remixCount || 0}
          </span>
          <span className="ex-proj-date">{new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
      
      <div className="ex-proj-hover-cta" style={{ display: "none" }} />
    </div>
  );
}

function ProfileCard({ user }) {
  const navigate = useNavigate();
  // Rank logic based on follower count for demo purposes
  const rank = user.followers?.length > 10 ? "gold" : user.followers?.length > 5 ? "silver" : "bronze";
  
  return (
    <div className="ex-prof-card" onClick={() => navigate(`/profile/${user._id}`)}>
      <div className={`ex-prof-avatar-wrap rank-${rank}`}>
        <Avatar user={user} size={64} />
        <div className="ex-prof-vibe-badge">{rank.toUpperCase()} VIBE</div>
      </div>

      <div className="ex-prof-body">
        <span className="ex-prof-username">@{user.username}</span>
        <p className="ex-prof-bio">{user.bio || "No bio yet. Vibing in the shadows."}</p>
      </div>

      <div className="ex-prof-skills">
        {user.skills?.slice(0, 3).map(s => (
          <span key={s} className="ex-skill-chip">{s}</span>
        ))}
      </div>

      <div className="ex-prof-stats">
        <div className="ex-pstat">
          <span className="ex-pstat-val">{user.projectCount || 0}</span>
          <span className="ex-pstat-lbl">Projects</span>
        </div>
        <div className="ex-pstat-divider" />
        <div className="ex-pstat">
          <span className="ex-pstat-val">{user.followers?.length || 0}</span>
          <span className="ex-pstat-lbl">Vibes</span>
        </div>
      </div>

      <div className="ex-vibe-row">
        <div className="ex-vibe-label">Vibe Level</div>
        <div className="ex-vibe-track">
          <div 
            className="ex-vibe-fill" 
            style={{ 
              width: `${Math.min(100, (user.followers?.length || 0) * 10 + (user.projectCount || 0) * 5)}%`, 
              background: `linear-gradient(90deg, var(--accent), var(--like))` 
            }} 
          />
        </div>
        <div className="ex-vibe-num">{Math.min(100, (user.followers?.length || 0) * 10 + (user.projectCount || 0) * 5)}</div>
      </div>

      <div className="ex-prof-view-btn">View Profile →</div>
    </div>
  );
}
