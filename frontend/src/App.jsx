import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Navbar from "./components/Navbar";
import ChatModal from "./components/ChatModal";
import Explore from "./pages/Explore";
import Feed from "./pages/Feed";
import Create from "./pages/Create";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Login from "./pages/Login";
import ProjectDetail from "./pages/ProjectDetail";
import ActivityFeed from "./pages/ActivityFeed";
import EditProject from "./pages/EditProject";
import SyncRequests from "./pages/SyncRequests";
import Search from "./pages/Search";
import ProjectIDE from "./pages/ProjectIDE";

function AppInner() {
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);

  // Listen for global chat open events
  useEffect(() => {
    const handleOpenChat = (e) => {
      const { userId, user: userData } = e.detail || {};
      if (userId) setChatOpen({ userId, user: userData });
      else setChatOpen(true);
    };
    window.addEventListener("vibe:open-chat", handleOpenChat);
    return () => window.removeEventListener("vibe:open-chat", handleOpenChat);
  }, []);

  return (
    <BrowserRouter>
      <Navbar setChatOpen={setChatOpen} />
      <Routes>
        <Route path="/" element={<Explore />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/activity" element={<ActivityFeed />} />
        <Route path="/create" element={<Create />} />
        <Route path="/profile/:id" element={<Profile openChat={(uid, u) => { setChatOpen({ userId: uid, user: u }); }} />} />
        <Route path="/profile/:id/edit" element={<EditProfile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/projects/:id/edit" element={<EditProject />} />
        <Route path="/projects/:id/ide" element={<ProjectIDE />} />
        <Route path="/projects/:id/sync-requests" element={<SyncRequests />} />
        <Route path="/search" element={<Search />} />
      </Routes>

      {/* Global floating chat button */}
      {user && (
        <button className="chat-fab" onClick={() => setChatOpen(true)} title="Messages">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
      )}

      {chatOpen && (
        <ChatModal
          onClose={() => setChatOpen(false)}
          initialUserId={chatOpen.userId || null}
          initialUser={chatOpen.user || null}
        />
      )}
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  );
}
