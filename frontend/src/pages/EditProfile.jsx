import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import "./EditProfile.css";

const AVATAR_BASE = "$env:REACT_APP_BASE_URL/uploads/";

export default function EditProfile() {
  const { id } = useParams();
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [bio, setBio] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState([]);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [currentAvatar, setCurrentAvatar] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.id !== id) { navigate(`/profile/${id}`); return; }
    api.get(`/users/${id}`).then(res => {
      setBio(res.data.bio || "");
      setSkills(res.data.skills || []);
      setCurrentAvatar(res.data.avatar || "");
      setIsPrivate(res.data.isPrivate || false);
    }).catch(() => setError("Failed to load profile data"));
  }, [id, user, navigate]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills(prev => [...prev, s]);
    setSkillInput("");
  };

  const removeSkill = (s) => setSkills(prev => prev.filter(sk => sk !== s));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = new FormData();
      data.append("bio", bio);
      data.append("skills", JSON.stringify(skills));
      data.append("isPrivate", isPrivate);
      if (avatarFile) data.append("avatar", avatarFile);

      const res = await api.put(`/users/${id}`, data);
      // Update auth context so navbar/profile reflect changes immediately
      updateUser({ bio: res.data.bio, skills: res.data.skills, avatar: res.data.avatar });
      navigate(`/profile/${id}`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to save";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const displayAvatar = avatarPreview || (currentAvatar ? `${AVATAR_BASE}${currentAvatar}` : "");

  return (
    <div className="edit-page">
      <div className="edit-card">
        <h1>Edit Profile</h1>
        <form onSubmit={handleSubmit} className="edit-form">

          <div className="avatar-section">
            <div className="avatar-preview">
              {displayAvatar
                ? <img src={displayAvatar} alt="avatar" />
                : <div className="avatar-placeholder">{user?.username?.[0]?.toUpperCase()}</div>
              }
            </div>
            <label className="avatar-upload-btn">
              Change Photo
              <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
            </label>
          </div>

          <div className="edit-field">
            <label>Bio</label>
            <textarea
              placeholder="Tell the world about yourself..."
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              maxLength={200}
            />
            <span className="char-count">{bio.length}/200</span>
          </div>

          <div className="edit-field">
            <label>Skills & Interests</label>
            <div className="skill-input-row">
              <input
                placeholder="e.g. React, Python, Design..."
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())}
              />
              <button type="button" onClick={addSkill} className="add-skill-btn">Add</button>
            </div>
            <div className="skills-list">
              {skills.map(s => (
                <span key={s} className="skill-chip">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)}>×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="edit-field privacy-toggle-row">
            <label>Private Profile</label>
            <button
              type="button"
              className={`toggle-btn ${isPrivate ? "on" : ""}`}
              onClick={() => setIsPrivate(p => !p)}
            >
              <span className="toggle-knob" />
            </button>
            <span className="toggle-hint">{isPrivate ? "Private — your projects are hidden" : "Public — your projects are visible"}</span>
          </div>

          {error && <p className="edit-error">⚠ {error}</p>}

          <div className="edit-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate(`/profile/${id}`)}>Cancel</button>
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
