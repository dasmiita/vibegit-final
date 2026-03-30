import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import "./ProjectIDE.css";

const getLanguage = (filename) => {
  if (!filename) return "plaintext";
  const ext = filename.split(".").pop().toLowerCase();
  switch (ext) {
    case "js": case "jsx": return "javascript";
    case "ts": case "tsx": return "typescript";
    case "py": return "python";
    case "html": return "html";
    case "css": return "css";
    case "json": return "json";
    case "md": return "markdown";
    case "java": return "java";
    case "c": case "cpp": case "h": case "hpp": return "cpp";
    case "cs": return "csharp";
    case "go": return "go";
    case "rs": return "rust";
    case "rb": return "ruby";
    case "php": return "php";
    case "sql": return "sql";
    case "sh": case "bash": return "shell";
    case "env": case "example": return "ini";
    default: return "plaintext";
  }
};

export default function ProjectIDE() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncSending, setSyncSending] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);

  const editorRef = useRef(null);

  useEffect(() => {
    if (!user) return navigate("/login");
    api.get(`/projects/${id}`).then(res => {
      setProject(res.data);
      if (res.data.files && res.data.files.length > 0) {
        handleFileSelect(0);
      } else {
        setCode(res.data.codeSnippet || "");
      }
      setLoading(false);
    }).catch(() => {
      navigate("/");
    });
  }, [id, user, navigate]);

  const handleFileSelect = async (index) => {
    setSelectedFileIndex(index);
    setFileLoading(true);
    try {
      const res = await api.get(`/projects/${id}/files/${index}/content`);
      setCode(res.data.content);
    } catch (err) {
      setCode("// Error loading file or file is not text-based.");
    } finally {
      setFileLoading(false);
    }
  };

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
  }

  const handleSave = async () => {
    if (selectedFileIndex === null) {
      // Legacy snippet save
      setSaving(true);
      try {
        await api.put(`/projects/${id}`, { codeSnippet: code });
        alert("Code saved successfully!");
      } catch (err) { alert("Error saving: " + err.message); }
      finally { setSaving(false); }
      return;
    }

    setSaving(true);
    try {
      await api.put(`/projects/${id}/files/${selectedFileIndex}/content`, { content: code });
      alert("File saved successfully!");
    } catch (err) {
      alert("Error saving file: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePullUpdates = async () => {
    if (!window.confirm("Pull latest changes from the original project? This will overwrite your current code and create a new version of your remix.")) return;
    try {
      const res = await api.post(`/projects/${id}/pull`);
      setProject(res.data);
      setCode(res.data.codeSnippet || "");
      alert("Successfully pulled latest changes!");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to pull updates");
    }
  };

  const handlePushToOriginal = async () => {
    setSyncSending(true);
    try {
      await api.post(`/projects/${project.remixedFrom._id || project.remixedFrom}/sync-request`);
      alert("✓ Push successful! Sync request sent to the original creator.");
    } catch (err) {
      alert(`Error: ${err.response?.data?.message || "Could not push"}`);
    } finally {
      setSyncSending(false);
    }
  };

  if (loading) return <div className="ide-loading"><div className="spinner"></div>Loading Vibe IDE...</div>;

  const isOwner = user && project && user.id === (project.userId?._id || project.userId)?.toString();
  const isRemix = !!project.remixedFrom;

  if (!isOwner) {
    return (
      <div className="ide-msg-container">
        <p>🔒 You must be the owner of this branch to use the IDE.</p>
        <button className="ide-btn" onClick={() => navigate(`/projects/${id}`)}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="ide-container">
      <div className="ide-header">
        <div className="ide-header-left">
          <Link to={`/projects/${id}`} className="ide-back-btn">← Back</Link>
          <div className="ide-title-block">
            <span className="ide-title">{project.title}</span>
            {isRemix && <span className="ide-badge">Branch</span>}
          </div>
        </div>
        <div className="ide-header-right">
          <button className="ide-btn" onClick={() => window.open(`${api.defaults.baseURL}/projects/${id}/download`)} title="Download ZIP">
            📥 ZIP
          </button>
          <button className="ide-btn save-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "💾 Save"}
          </button>
          {isRemix && (
            <>
              <button className="ide-btn pull-btn" onClick={handlePullUpdates}>
                ⬇ Pull
              </button>
              <button className="ide-btn push-btn" onClick={handlePushToOriginal} disabled={syncSending}>
                {syncSending ? "Pushing..." : "⬆ Push"}
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="ide-main">
         <div className="ide-sidebar">
            <div className="sidebar-section">
              <h4>Vibe Navigator</h4>
              <div className="file-tree">
                {project.files && project.files.length > 0 ? (
                  project.files.map((file, i) => (
                    <div 
                      key={i} 
                      className={`file-item ${selectedFileIndex === i ? "active" : ""}`}
                      onClick={() => handleFileSelect(i)}
                    >
                      <span className="file-icon">📄</span>
                      <span className="file-name">{file.name}</span>
                    </div>
                  ))
                ) : (
                  <p className="no-files">No project files found.</p>
                )}
              </div>
            </div>
            
            <div className="sidebar-section divider"></div>

            <div className="sidebar-section">
              <h4>Project Desc</h4>
              <p className="sidebar-desc">{project.description}</p>
            </div>
            {isRemix && (
              <div className="sidebar-section">
                <h4>Sync Control</h4>
                <div className="sidebar-hint">
                  <p><strong>Pull</strong> to fetch latest original code.</p>
                  <p><strong>Push</strong> to suggest your edits back.</p>
                </div>
              </div>
            )}
         </div>
         <div className="ide-editor-wrapper">
           {fileLoading ? (
             <div className="editor-loading">Loading file...</div>
           ) : (
             <Editor
               height="100%"
               language={selectedFileIndex !== null ? getLanguage(project.files[selectedFileIndex].name) : "javascript"}
               theme="vs-dark"
               value={code}
               onChange={(value) => setCode(value)}
               onMount={handleEditorDidMount}
               options={{
                 minimap: { enabled: false },
                 fontSize: 14,
                 wordWrap: "on",
                 fontFamily: "'Fira Code', monospace",
                 smoothScrolling: true,
                 cursorBlinking: "smooth"
               }}
             />
           )}
         </div>
      </div>
    </div>
  );
}
