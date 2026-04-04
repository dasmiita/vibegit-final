import { useEffect, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import ProjectCard from "../components/ProjectCard";
import "./Search.css";

function Avatar({ user, size = 32 }) {
  const url = user?.avatar ? `$env:REACT_APP_BASE_URL/uploads/${user.avatar}` : null;
  const letter = (user?.username || "?")[0].toUpperCase();
  if (url) return <img src={url} alt="" className="sr-avatar-img" style={{ width: size, height: size }} />;
  return <div className="sr-avatar-placeholder" style={{ width: size, height: size, fontSize: size * 0.4 }}>{letter}</div>;
}

const AVATAR_BASE = "$env:REACT_APP_BASE_URL/uploads/";

export default function Search() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const q = new URLSearchParams(location.search).get("q") || "";
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleUserFollow = async (e, u) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return navigate("/login");
    try {
      const res = await api.post(`/users/${u._id}/follow`);
      setUsers((prev) =>
        prev.map((x) =>
          x._id === u._id ? { ...x, isFollowing: res.data.following } : x
        )
      );
    } catch {}
  };

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    api.get(`/users/search?q=${encodeURIComponent(q)}`)
      .then(res => {
        setUsers(res.data.users || []);
        setProjects(res.data.projects || []);
      })
      .finally(() => setLoading(false));
  }, [q]);

  if (!q) return <div className="search-page"><p className="empty">Type something to search.</p></div>;

  return (
    <div className="search-page">
      <h1 className="page-title">Results for "{q}"</h1>

      {loading ? (
        <p className="loading">Searching...</p>
      ) : (
        <>
          <section className="search-section">
            <h2>Users</h2>
            {users.length === 0 ? (
              <p className="empty">No users found.</p>
            ) : (
              <div className="search-users">
                {users.map((u) => (
                  <div key={u._id} className="search-user-item">
                    <Link to={`/profile/${u._id}`} className="search-user-link">
                      <Avatar user={u} size={44} />
                      <div className="search-user-info">
                        <span className="search-user-name">@{u.username}</span>
                        <span className="search-user-slug">Software Artisan</span>
                      </div>
                    </Link>
                    {String(user?.id) !== String(u._id) && (
                      <button
                        type="button"
                        className={`search-follow-btn ${u.isFollowing ? "following" : ""}`}
                        onClick={(e) => handleUserFollow(e, u)}
                      >
                        {u.isFollowing ? "Following" : "Follow"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="search-section">
            <h2>Projects</h2>
            {projects.length === 0 ? (
              <p className="empty">No projects found.</p>
            ) : (
              <div className="search-projects">
                {projects.map(p => (
                  <ProjectCard key={p._id} project={p} compact />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
