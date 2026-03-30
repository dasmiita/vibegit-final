import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { DOMAINS, DOMAIN_TAGS } from "../utils/domains";
import "./EditProject.css";

const STATUS_OPTIONS = [
  { value: "idea",        label: "💡 Idea" },
  { value: "in-progress", label: "🚧 In Progress" },
  { value: "completed",   label: "✅ Completed" }
];

export default function EditProject() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ title: "", description: "", codeSnippet: "" });
  const [about, setAbout] = useState({ features: "", howItWorks: "", futurePlans: "" });
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState("idea");
  const [extraTags, setExtraTags] = useState("");
  const [newFiles, setNewFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/projects/${id}`).then(res => {
      const p = res.data;
      // Redirect if not owner
      if (!user || user.id !== (p.userId?._id || p.userId)?.toString()) {
        navigate(`/projects/${id}`);
        return;
      }
      setForm({ title: p.title, description: p.description, codeSnippet: p.codeSnippet || "" });
      setAbout({ features: p.about?.features || "", howItWorks: p.about?.howItWorks || "", futurePlans: p.about?.futurePlans || "" });
      setDomain(p.domain || "");
      setStatus(p.status || "idea");
      // Restore extra tags (non-auto ones)
      const autoTags = p.domain ? (DOMAIN_TAGS[p.domain] || []) : [];
      const extra = (p.tags || []).filter(t => !autoTags.includes(t));
      setExtraTags(extra.join(", "));
    }).catch(() => navigate(`/projects/${id}`))
      .finally(() => setLoading(false));
  }, [id, user, navigate]);

  const autoTags = domain ? (DOMAIN_TAGS[domain] || []) : [];
  const allTags = [
    ...autoTags,
    ...extraTags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = new FormData();
      data.append("title", form.title);
      data.append("description", form.description);
      data.append("codeSnippet", form.codeSnippet);
      data.append("tags", JSON.stringify(allTags));
      data.append("domain", domain);
      data.append("status", status);
      data.append("features", about.features);
      data.append("howItWorks", about.howItWorks);
      data.append("futurePlans", about.futurePlans);
      newFiles.forEach(f => data.append("files", f));
      await api.put(`/projects/${id}`, data);
      navigate(`/projects/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="loading">Loading project...</p>;

  return (
    <div className="edit-project-page">
      <div className="edit-project-card">
        <div className="edit-project-header">
          <h1>Edit Project</h1>
          <span className="version-note">💾 Saving will create a new version</span>
        </div>

        <form onSubmit={handleSubmit} className="edit-project-form">
          <input
            placeholder="Project title"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            required
          />
          <textarea
            placeholder="Short description..."
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            rows={3}
            required
          />

          <div className="ep-section">
            <label>Status</label>
            <div className="status-picker">
              {STATUS_OPTIONS.map(s => (
                <button type="button" key={s.value}
                  className={`status-btn ${status === s.value ? "selected" : ""}`}
                  onClick={() => setStatus(s.value)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ep-section">
            <label>Domain</label>
            <div className="domain-picker">
              {DOMAINS.map(d => (
                <button type="button" key={d}
                  className={`domain-btn ${domain === d ? "selected" : ""}`}
                  onClick={() => setDomain(prev => prev === d ? "" : d)}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {autoTags.length > 0 && (
            <div className="auto-tags">
              <span className="auto-tags-label">Auto tags:</span>
              {autoTags.map(t => <span key={t} className="tag">#{t}</span>)}
            </div>
          )}

          <div className="ep-section">
            <label>Extra Tags <span className="optional">(comma separated)</span></label>
            <input
              placeholder="e.g. react, beginner"
              value={extraTags}
              onChange={e => setExtraTags(e.target.value)}
            />
          </div>

          <div className="ep-section about-section">
            <label>About Project</label>
            <textarea placeholder="✨ Key features..." value={about.features}
              onChange={e => setAbout({ ...about, features: e.target.value })} rows={2} />
            <textarea placeholder="⚙️ How does it work?" value={about.howItWorks}
              onChange={e => setAbout({ ...about, howItWorks: e.target.value })} rows={2} />
            <textarea placeholder="🚀 Future plans..." value={about.futurePlans}
              onChange={e => setAbout({ ...about, futurePlans: e.target.value })} rows={2} />
          </div>

          <textarea
            placeholder="Code snippet (optional)"
            value={form.codeSnippet}
            onChange={e => setForm({ ...form, codeSnippet: e.target.value })}
            rows={4}
            className="code-input"
          />

          <div className="ep-section">
            <label>Add More Files <span className="optional">(appended to existing)</span></label>
            <input type="file" multiple onChange={e => setNewFiles(Array.from(e.target.files))} className="file-input" />
            {newFiles.length > 0 && (
              <ul className="file-preview">
                {newFiles.map((f, i) => <li key={i}>📄 {f.name} <span>({(f.size/1024).toFixed(1)} KB)</span></li>)}
              </ul>
            )}
          </div>

          {error && <p className="ep-error">{error}</p>}

          <div className="ep-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate(`/projects/${id}`)}>Cancel</button>
            <button type="submit" className="save-btn" disabled={saving}>
              {saving ? "Saving..." : "Save New Version"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
