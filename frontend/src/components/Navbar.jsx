import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
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
  const [showPrefs, setShowPrefs] = useState(false);

  const isActive = (path) => location.pathname === path ? "active-link" : "";

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`);
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

      <form className="navbar-search" onSubmit={handleSearch}>
        <input
          placeholder="Search users & projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </form>

      <div className="navbar-links">
        <Link to="/" className={isActive("/")}>Explore</Link>
        <Link to="/feed" className={isActive("/feed")}>Feed</Link>
        <Link to="/activity" className={isActive("/activity")}>Activity</Link>
        {user && (
          <button className="nav-msg-btn" onClick={() => setChatOpen(true)} title="Messages">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-msg-icon">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span className="nav-msg-badge" />
          </button>
        )}

        <div className="nav-divider" />

        {user ? (
          <>
            <Link to="/create" className="nav-create-btn">+ Create</Link>
            <Link to={`/profile/${user.id}`} className={isActive(`/profile/${user.id}`)}>
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
