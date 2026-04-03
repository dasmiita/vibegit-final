import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Avatar from "./Avatar";
import PullSwitch from "./PullSwitch";
import OceanTap from "./OceanTap";
import "./Navbar.css";

export default function Navbar({ setChatOpen }) {
  const { user, logout } = useAuth();
  const { accent, oceanMode, toggleOcean } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifUnread, setNotifUnread] = useState(false);

  const isActive = (path) => location.pathname === path ? "active-link" : "";

  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => {
      import("../api/axios").then(m => m.default.get("/messages/unread/count"))
        .then(res => setUnreadCount(res.data.count)).catch(() => {});
    };
    const fetchNotifications = () => {
      import("../api/axios").then(m => m.default.get("/notifications"))
        .then(res => {
          setNotifications(res.data);
          const count = res.data.filter(n => !n.isRead).length;
          setNotifUnread(count > 0 ? count : false);
        }).catch(() => {});
    };
    fetchUnread(); fetchNotifications();
    const interval = setInterval(() => { fetchUnread(); fetchNotifications(); }, 15000);
    window.addEventListener("vibe:unread-update", fetchUnread);
    return () => { clearInterval(interval); window.removeEventListener("vibe:unread-update", fetchUnread); };
  }, [user]);

  const markAsRead = () => {
    import("../api/axios").then(m => m.default.post("/notifications/read"))
      .then(() => setNotifUnread(false)).catch(() => {});
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim().length > 1) {
        setLoading(true);
        import("../api/axios").then(m => m.default.get(`/users/search?q=${encodeURIComponent(search.trim())}`))
          .then(res => { setResults(res.data); setShowDropdown(true); })
          .catch(() => {}).finally(() => setLoading(false));
      } else { setResults(null); setShowDropdown(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) { setShowDropdown(false); navigate(`/search?q=${encodeURIComponent(search.trim())}`); }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        <span className="navbar-logo-text" style={{ backgroundImage: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}>
          VibeGit
        </span>
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
            <button className="dropdown-footer" onClick={handleSearch}>View all results for "{search}"</button>
          </div>
        )}
      </div>

      <div className="navbar-links">
        <Link to="/" className={isActive("/")}>Explore</Link>
        <Link to="/feed" className={isActive("/feed")}>Feed</Link>
        <Link to="/activity" className={isActive("/activity")}>Activity</Link>

        {user && (
          <div className="nav-notif-wrapper" style={{ position: "relative" }}>
            <button className="nav-msg-btn" onClick={() => { if (!showNotifications) markAsRead(); setShowNotifications(!showNotifications); }} title="Notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-msg-icon">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notifUnread && <span className="nav-msg-badge" style={{ background:"#ef4444", width:"auto", minWidth:"16px", height:"16px", borderRadius:"10px", padding:"0 4px", fontSize:"0.65rem", display:"flex", alignItems:"center", justifyContent:"center" }}>{notifUnread}</span>}
            </button>
            {showNotifications && (
              <div style={{ position:"absolute", top:"100%", right:0, width:"300px", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"12px", marginTop:"10px", boxShadow:"0 10px 25px rgba(0,0,0,0.5)", zIndex:1000, overflow:"hidden" }}>
                <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontWeight:"bold", fontSize:"0.9rem" }}>Notifications</span>
                </div>
                <div style={{ maxHeight:"350px", overflowY:"auto" }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding:"30px 20px", textAlign:"center", color:"#666", fontSize:"0.85rem" }}>No notifications yet</div>
                  ) : notifications.map(n => (
                    <div key={n._id} style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)", background:n.isRead?"transparent":"rgba(59,130,246,0.05)", cursor:"pointer", transition:"background 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.03)"}
                      onMouseLeave={e => e.currentTarget.style.background=n.isRead?"transparent":"rgba(59,130,246,0.05)"}>
                      <p style={{ margin:0, fontSize:"0.82rem", color:"#ddd", lineHeight:"1.4" }}>{n.message}</p>
                      <span style={{ fontSize:"0.7rem", color:"#666" }}>{new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
                <Link to="/activity" style={{ display:"block", textAlign:"center", padding:"10px", fontSize:"0.75rem", color:"var(--accent)", textDecoration:"none", background:"rgba(255,255,255,0.02)" }} onClick={() => setShowNotifications(false)}>
                  View all activity
                </Link>
              </div>
            )}
          </div>
        )}

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

        <PullSwitch inline />
        <OceanTap active={oceanMode} onToggle={toggleOcean} />
      </div>
    </nav>
  );
}
