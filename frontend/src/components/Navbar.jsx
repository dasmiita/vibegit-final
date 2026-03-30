import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Avatar from "./Avatar";
import "./Navbar.css";

const ACCENTS = ["#a78bfa", "#f472b6", "#34d399", "#60a5fa", "#fb923c", "#facc15"];
const FONTS = [
  { key: "inter", label: "Sans" },
  { key: "mono",  label: "Mono" },
  { key: "serif", label: "Serif" }
];

export default function Navbar({ setChatOpen }) {
  const { user, logout } = useAuth();
  const { theme, toggle, accent, setAccent, font, setFont, layout, setLayout } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null); // { users, projects }
  const [loading, setLoading] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isActive = (path) => location.pathname === path ? "active-link" : "";

  // Fetch unread count
  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => {
      import("../api/axios").then(m => m.default.get("/messages/unread/count"))
        .then(res => setUnreadCount(res.data.count))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000); // Poll every 15s (increased for optimization)
    
    window.addEventListener("vibe:unread-update", fetchUnread);
    return () => {
      clearInterval(interval);
      window.removeEventListener("vibe:unread-update", fetchUnread);
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim().length > 1) {
        setLoading(true);
        import("../api/axios").then(m => m.default.get(`/users/search?q=${encodeURIComponent(search.trim())}`))
          .then(res => {
            setResults(res.data);
            setShowDropdown(true);
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setResults(null);
        setShowDropdown(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      setShowDropdown(false);
      navigate(`/search?q=${encodeURIComponent(search.trim())}`);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        <span>VibeGit</span>
      </Link>

      <div className="navbar-search-container">
        <form className="navbar-search" onSubmit={handleSearch}>
          <input
            placeholder="Search users & projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => search.trim() && setShowDropdown(true)}
          />
        </form>
        {showDropdown && results && (
          <div className="search-dropdown">
            {results.users?.length > 0 && (
              <div className="dropdown-section">
                <p className="dropdown-label">Users</p>
                {results.users.slice(0, 3).map(u => (
                  <Link key={u._id} to={`/profile/${u._id}`} className="dropdown-item" onClick={() => setShowDropdown(false)}>
                    <Avatar user={u} size={28} className="dropdown-avatar-comp" />
                    <span>@{u.username}</span>
                  </Link>
                ))}
              </div>
            )}
            {results.projects?.length > 0 && (
              <div className="dropdown-section">
                <p className="dropdown-label">Projects</p>
                {results.projects.slice(0, 4).map(p => (
                  <Link key={p._id} to={`/projects/${p._id}`} className="dropdown-item" onClick={() => setShowDropdown(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dropdown-icon-svg">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <div className="dropdown-info">
                      <span className="dropdown-name">{p.title}</span>
                      <span className="dropdown-author">by @{p.userId?.username}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {!loading && results.users?.length === 0 && results.projects?.length === 0 && (
              <p className="dropdown-empty">No results found</p>
            )}
            <button className="dropdown-footer" onClick={handleSearch}>
              View all results for "{search}"
            </button>
          </div>
        )}
      </div>

      <div className="navbar-links">
        <Link to="/" className={isActive("/")}>Explore</Link>
        <Link to="/feed" className={isActive("/feed")}>Feed</Link>
        <Link to="/activity" className={isActive("/activity")}>Activity</Link>
        {user && (
          <button className="nav-msg-btn" onClick={() => setChatOpen(true)} title="Messages">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-msg-icon">
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            </svg>
            {unreadCount > 0 && <span className="nav-msg-badge" />}
          </button>
        )}

        <div className="nav-divider" />

        {user ? (
          <>
            <Link to="/create" className="nav-create-btn">+ Create</Link>
            <Link to={`/profile/${user.id}`} className={`nav-profile-link ${isActive(`/profile/${user.id}`)}`}>
              <Avatar user={user} size={24} className="nav-avatar" />
              @{user.username}
            </Link>
            <button onClick={handleLogout} className="nav-btn">Sign out</button>
          </>
        ) : (
          <Link to="/login" className="nav-create-btn">Sign in</Link>
        )}

        <div className="prefs-wrapper">
          <button
            className="nav-btn"
            onClick={() => setShowPrefs(p => !p)}
            title="Preferences"
            style={{ fontSize: "1rem", padding: "0.35rem 0.5rem" }}
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
          {showPrefs && (
            <div className="prefs-panel">
              <div className="prefs-row">
                <span>Theme</span>
                <button className="nav-btn" onClick={toggle}>
                  {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
                </button>
              </div>
              <div className="prefs-row">
                <span>Accent</span>
                <div className="accent-swatches">
                  {ACCENTS.map(c => (
                    <button
                      key={c}
                      className={`swatch ${accent === c ? "active" : ""}`}
                      style={{ background: c }}
                      onClick={() => setAccent(c)}
                    />
                  ))}
                  <input
                    type="color"
                    value={accent}
                    onChange={e => setAccent(e.target.value)}
                    className="color-input"
                    title="Custom color"
                  />
                </div>
              </div>
              <div className="prefs-row">
                <span>Font</span>
                <div className="font-btns">
                  {FONTS.map(f => (
                    <button
                      key={f.key}
                      className={`nav-btn ${font === f.key ? "active-pref" : ""}`}
                      onClick={() => setFont(f.key)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="prefs-row">
                <span>Layout</span>
                <div className="font-btns">
                  <button className={`nav-btn ${layout === "grid" ? "active-pref" : ""}`} onClick={() => setLayout("grid")}>⊞ Grid</button>
                  <button className={`nav-btn ${layout === "list" ? "active-pref" : ""}`} onClick={() => setLayout("list")}>☰ List</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
