import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import "./ChatModal.css";
const BASE = "http://localhost:5000/uploads/";

function Avatar({ user, size = 34 }) {
  const url = user?.avatar ? `${BASE}${user.avatar}` : null;
  const letter = (user?.username || "?")[0].toUpperCase();
  if (url) return <img src={url} alt="" className="chat-avatar-img" style={{ width: size, height: size }} />;
  return <div className="chat-avatar-placeholder" style={{ width: size, height: size, fontSize: size * 0.4 }}>{letter}</div>;
}

export default function ChatModal({ onClose, initialUserId, initialUser }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // { _id, username, avatar }
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const bottomRef = useRef(null);

  // Load conversations
  useEffect(() => {
    setLoading(true);
    api.get("/messages/conversations").then(res => {
      setConversations(res.data);
      if (res.data.length === 0) {
        // Fetch suggestions if no conversations
        api.get("/users/suggestions").then(sug => setSuggestions(sug.data));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // If opened with a specific user, auto-open that chat
  useEffect(() => {
    if (initialUserId && initialUser) {
      openChat({ _id: initialUserId, username: initialUser.username, avatar: initialUser.avatar });
    }
  }, [initialUserId]);

  const openChat = async (partner) => {
    setActiveChat(partner);
    try {
      const res = await api.get(`/messages/${partner._id}`);
      setMessages(res.data);
    } catch {}
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeChat) return;
    setSending(true);
    try {
      const res = await api.post(`/messages/${activeChat._id}`, { text });
      setMessages(prev => [...prev, res.data]);
      setText("");
      // Update conversations list
      setConversations(prev => {
        const exists = prev.some(c => c._id === activeChat._id);
        if (exists) return prev;
        return [activeChat, ...prev];
      });
      // Remove from suggestions if they were there
      setSuggestions(prev => prev.filter(s => s._id !== activeChat._id));
    } catch {}
    setSending(false);
  };

  const handleFollow = async (userId) => {
    try {
      await api.post(`/users/${userId}/follow`);
      // Update suggestion to show followed state or just allow messaging
      const target = suggestions.find(s => s._id === userId);
      if (target) openChat(target);
    } catch {}
  };

  if (!user) return null;

  return (
    <div className="chat-overlay" onClick={onClose}>
      <div className="chat-modal" onClick={e => e.stopPropagation()}>
        {/* Sidebar: Conversations */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <span className="chat-title">💬 Messages</span>
            <button className="chat-close-btn" onClick={onClose}>✕</button>
          </div>
          {loading ? (
            <p className="chat-empty">Loading...</p>
          ) : conversations.length === 0 ? (
            <div className="chat-suggestions-sidebar">
              <p className="chat-sidebar-sub">Suggested Users</p>
              {suggestions.length === 0 ? (
                <p className="chat-empty-faint">No suggestions yet. Explore projects!</p>
              ) : (
                <div className="chat-convo-list">
                  {suggestions.map(s => (
                    <div key={s._id} className="chat-convo-item suggestion" onClick={() => openChat(s)}>
                      <Avatar user={s} size={36} />
                      <div className="chat-convo-info">
                        <span className="chat-convo-name">@{s.username}</span>
                        <button className="chat-follow-btn" onClick={(e) => { e.stopPropagation(); handleFollow(s._id); }}>
                          Follow & Message
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="chat-convo-list">
              {conversations.map(partner => (
                <div
                  key={partner._id}
                  className={`chat-convo-item ${activeChat?._id === partner._id ? "active" : ""}`}
                  onClick={() => openChat(partner)}
                >
                  <Avatar user={partner} size={36} />
                  <span className="chat-convo-name">@{partner.username}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Window */}
        <div className="chat-window">
          {!activeChat ? (
            <div className="chat-empty-state">
              <div className="chat-empty-icon">💬</div>
              <p>Select a conversation or go to a user's profile and click <strong>Message</strong></p>
            </div>
          ) : (
            <>
              <div className="chat-window-header">
                <Avatar user={activeChat} size={32} />
                <span className="chat-window-name">@{activeChat.username}</span>
              </div>
              <div className="chat-messages-area">
                {messages.length === 0 && (
                  <p className="chat-no-msgs">Start chatting with @{activeChat.username}!</p>
                )}
                {messages.map((msg, i) => {
                  const isMine = msg.senderId === user.id || msg.senderId?.toString() === user.id;
                  return (
                    <div key={i} className={`chat-bubble-row ${isMine ? "mine" : "theirs"}`}>
                      <div className={`chat-bubble ${isMine ? "bubble-mine" : "bubble-theirs"}`}>
                        {msg.text}
                        <span className="chat-time">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form className="chat-input-row" onSubmit={handleSend}>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={`Message @${activeChat.username}...`}
                  className="chat-input"
                  autoFocus
                />
                <button type="submit" className="chat-send-btn" disabled={sending || !text.trim()}>
                  {sending ? "..." : "Send ➤"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
