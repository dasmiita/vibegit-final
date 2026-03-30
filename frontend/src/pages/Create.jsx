import { useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Toast, { useToast } from "../components/Toast";
import UploadModal from "../components/UploadModal";
import { DOMAINS, DOMAIN_TAGS } from "../utils/domains";
import "./Create.css";

const STATUS_OPTIONS = [
  { value: "idea",        label: "💡 Idea",        desc: "Just an idea, not started yet" },
  { value: "in-progress", label: "🚧 In Progress",  desc: "Currently working on it" },
  { value: "completed",   label: "✅ Completed",    desc: "Finished and ready to share" }
];

export default function Create() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", codeSnippet: "" });
  const [about, setAbout] = useState({ features: "", howItWorks: "", futurePlans: "" });
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState("idea");
  const [extraTags, setExtraTags] = useState("");
  const [files, setFiles] = useState([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [readme, setReadme] = useState("");
  const { toasts, show: showToast, dismiss } = useToast();
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  
  // Upload progress states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle, uploading, done, error
  const abortControllerRef = React.useRef(null);

  // Load draft on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("vibe:project_draft");
    if (saved) {
      setHasDraft(true);
    }
  }, []);

  const restoreDraft = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("vibe:project_draft"));
      if (saved) {
        setForm(saved.form || { title: "", description: "", codeSnippet: "" });
        setAbout(saved.about || { features: "", howItWorks: "", futurePlans: "" });
        setDomain(saved.domain || "");
        setStatus(saved.status || "idea");
        setExtraTags(saved.extraTags || "");
        setReadme(saved.readme || "");
        showToast("Draft restored! Note: You'll need to re-select your files.", "info", "Draft Restored");
      }
    } catch {}
    setHasDraft(false);
  };

  const clearDraft = () => {
    localStorage.removeItem("vibe:project_draft");
    setHasDraft(false);
  };

  // Save draft on changes
  React.useEffect(() => {
    const draft = { form, about, domain, status, extraTags, readme };
    // Only save if there's actual content
    if (form.title || form.description || readme || about.features) {
      localStorage.setItem("vibe:project_draft", JSON.stringify(draft));
    }
  }, [form, about, domain, status, extraTags, readme]);

  const EXCLUDE_DIRS = [
    "node_modules", ".git", ".next", "dist", "build", "venv", "__pycache__",
    ".cache", ".vscode", "target", "vendor", ".idea", ".gradle", "bin", "obj",
    "env", ".venv", "Lib", "site-packages", ".pytest_cache", ".sass-cache",
    "bower_components", "jspm_packages", "platforms", "plugins"
  ];
  const EXCLUDE_FILES = [".DS_Store", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", ".env.local"];

  const fileInputRef = React.useRef();
  const folderInputRef = React.useRef();

  // Recursively read a FileEntry into a File object with path metadata
  const readEntryAsFile = (entry) =>
    new Promise(resolve => {
      entry.file(f => {
        // Use a relative path from the drop root
        const path = entry.fullPath.replace(/^\//, "");
        // We can't always write to webkitRelativePath, so we attach it as a custom property
        // The backend already looks for this in the FormData or our JSON.stringify(relativePaths)
        Object.defineProperty(f, "uploadRelativePath", {
          value: path,
          writable: false,
        });
        resolve(f);
      });
    });

  // Recursively walk a directory entry and collect all File objects
  const readDir = async (dirEntry) => {
    const collected = [];
    const reader = dirEntry.createReader();
    const readEntries = () => new Promise(resolve => reader.readEntries(resolve));

    let entries;
    do {
      entries = await readEntries();
      for (const entry of entries) {
        if (EXCLUDE_DIRS.includes(entry.name) || EXCLUDE_FILES.includes(entry.name)) {
          setSkippedCount(prev => prev + 1);
          continue;
        }
        if (entry.isFile) {
          collected.push(await readEntryAsFile(entry));
        } else if (entry.isDirectory) {
          collected.push(...(await readDir(entry)));
        }
      }
    } while (entries.length > 0);
    return collected;
  };

  // Handle drop — reads folders recursively
  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const items = Array.from(e.dataTransfer.items || []);
    const droppedFiles = [];

    if (items.length > 0) {
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (!entry) continue;
        if (entry.isFile) droppedFiles.push(await readEntryAsFile(entry));
        else if (entry.isDirectory) droppedFiles.push(...(await readDir(entry)));
      }
    } else {
      // Fallback for browsers that don't support DataTransferItem (very rare now)
      droppedFiles.push(...Array.from(e.dataTransfer.files || []));
    }

    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleFileSelection = (e) => {
    const selected = Array.from(e.target.files);
    let newFiles = [];
    let skipped = 0;

    selected.forEach(f => {
      const path = f.webkitRelativePath || f.name;
      const parts = path.split("/");
      const isExcluded = parts.some(part => EXCLUDE_DIRS.includes(part) || EXCLUDE_FILES.includes(part));
      
      if (isExcluded) skipped++;
      else newFiles.push(f);
    });

    if (skipped > 0) setSkippedCount(prev => prev + skipped);
    setFiles(prev => [...prev, ...newFiles]);
  };

  if (!user) { navigate("/login"); return null; }

  const autoTags = domain ? DOMAIN_TAGS[domain] : [];
  const allTags = [
    ...autoTags,
    ...extraTags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setUploadProgress(0);
    setUploadStatus("uploading");
    setShowUploadModal(true);
    
    abortControllerRef.current = new AbortController();

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
      
      const allFiles = [...files];
      if (readme.trim()) {
        const readmeFile = new File([readme], "README.md", { type: "text/markdown" });
        allFiles.push(readmeFile);
      }

      allFiles.forEach(f => data.append("files", f, f.name));
      const relativePaths = allFiles.map(f => f.uploadRelativePath || f.webkitRelativePath || f.name);
      data.append("relativePaths", JSON.stringify(relativePaths));

      await api.post("/projects", data, {
        signal: abortControllerRef.current.signal,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      setUploadStatus("done");
      clearDraft();
      showToast("Your project has been posted successfully!", "success", "Project Created 🎉");
      setTimeout(() => {
        setShowUploadModal(false);
        navigate("/");
      }, 1500);
    } catch (err) {
      if (err.name === "CanceledError" || err.message === "canceled") {
        showToast("Upload canceled by user", "info", "Canceled");
      } else {
        setUploadStatus("error");
        const msg = err.response?.data?.message || "Failed to create project";
        showToast(msg, "error", "Submission Failed");
      }
      setShowUploadModal(false);
    } finally {
      setLoading(false);
    }
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="create-page">
      <div className="create-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <h1>New Project</h1>
          {hasDraft && (
            <button type="button" className="restore-draft-btn" onClick={restoreDraft}>
              ✨ Restore Draft
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="create-form">

          <input
            placeholder="Project title"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            required
          />
          <textarea
            placeholder="Short description of your project..."
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            rows={3}
            required
          />

          {/* Status */}
          <div className="create-section">
            <label>Project Status</label>
            <div className="status-picker">
              {STATUS_OPTIONS.map(s => (
                <button
                  type="button"
                  key={s.value}
                  className={`status-btn status-${s.value} ${status === s.value ? "selected" : ""}`}
                  onClick={() => setStatus(s.value)}
                  title={s.desc}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Domain */}
          <div className="create-section">
            <label>Domain <span className="optional">(auto-assigns tags)</span></label>
            <div className="domain-picker">
              {DOMAINS.map(d => (
                <button
                  type="button"
                  key={d}
                  className={`domain-btn ${domain === d ? "selected" : ""}`}
                  onClick={() => setDomain(prev => prev === d ? "" : d)}
                >
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

          <div className="create-section">
            <label>Extra Tags <span className="optional">(comma separated)</span></label>
            <input
              placeholder="e.g. react, beginner, portfolio"
              value={extraTags}
              onChange={e => setExtraTags(e.target.value)}
            />
          </div>

          {/* About section */}
          <div className="create-section about-section">
            <label>About Project <span className="optional">(optional but recommended)</span></label>
            <textarea
              placeholder="✨ Key features of your project..."
              value={about.features}
              onChange={e => setAbout({ ...about, features: e.target.value })}
              rows={2}
            />
            <textarea
              placeholder="⚙️ How does it work?"
              value={about.howItWorks}
              onChange={e => setAbout({ ...about, howItWorks: e.target.value })}
              rows={2}
            />
            <textarea
              placeholder="🚀 Future plans or ideas..."
              value={about.futurePlans}
              onChange={e => setAbout({ ...about, futurePlans: e.target.value })}
              rows={2}
            />
          </div>

          <textarea
            placeholder="Paste a code snippet (optional)"
            value={form.codeSnippet}
            onChange={e => setForm({ ...form, codeSnippet: e.target.value })}
            rows={4}
            className="code-input"
          />

          <div className="create-section">
            <label>Upload Files / Folders <span className="optional">(max 10MB each)</span></label>

            {/* Hidden real inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={handleFileSelection}
            />
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory="true"
              directory="true"
              multiple
              style={{ display: "none" }}
              onChange={handleFileSelection}
            />

            {/* Drag-and-drop zone */}
            <div
              className={`upload-zone ${dragOver ? "drag-active" : ""} ${files.length > 0 ? "has-files" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {files.length === 0 ? (
                <>
                  <div className="upload-zone-icon">📁</div>
                  <p className="upload-zone-label">Drag & drop files or folders here</p>
                  <p className="upload-zone-sub">or choose below</p>
                  <div className="upload-zone-btns">
                    <button type="button" className="upload-btn" onClick={() => fileInputRef.current.click()}>
                      📄 Choose Files
                    </button>
                    <button type="button" className="upload-btn upload-btn-folder" onClick={() => folderInputRef.current.click()}>
                      📁 Upload Folder
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="upload-file-header">
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span className="upload-file-count">✅ {files.length} file{files.length !== 1 ? "s" : ""} selected</span>
                      {skippedCount > 0 && <span className="upload-skipped-label">🛡️ Skipped {skippedCount} dependency files</span>}
                    </div>
                    <button type="button" className="upload-clear-btn" onClick={() => { setFiles([]); setSkippedCount(0); }}>Clear</button>
                  </div>
                  <ul className="upload-file-list">
                    {files.slice(0, 8).map((f, i) => (
                      <li key={i} className="upload-file-item">
                        <span className="upload-file-name">{f.uploadRelativePath || f.webkitRelativePath || f.name}</span>
                        <span className="upload-file-size">{(f.size / 1024).toFixed(1)} KB</span>
                      </li>
                    ))}
                    {files.length > 8 && (
                      <li className="upload-more-text">+{files.length - 8} more files...</li>
                    )}
                  </ul>
                  <div className="upload-zone-btns" style={{ marginTop: "0.75rem" }}>
                    <button type="button" className="upload-btn" onClick={() => fileInputRef.current.click()}>Add More</button>
                    <button type="button" className="upload-btn upload-btn-folder" onClick={() => folderInputRef.current.click()}>Upload Folder</button>
                  </div>
                </>
              )}
            </div>
          </div>

          <Toast toasts={toasts} dismiss={dismiss} />

          <UploadModal 
            isOpen={showUploadModal} 
            files={files} 
            skipped={skippedCount} 
            progress={uploadProgress}
            status={uploadStatus}
            onCancel={cancelUpload}
          />

          <div className="create-section">
            <label>README.md <span className="optional">(optional)</span></label>
            <textarea
              placeholder="Tell the world about your project... (Markdown supported)"
              value={readme}
              onChange={e => setReadme(e.target.value)}
              rows={6}
              className="readme-input"
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Posting..." : "Post Project"}
          </button>
        </form>
      </div>
    </div>
  );
}
