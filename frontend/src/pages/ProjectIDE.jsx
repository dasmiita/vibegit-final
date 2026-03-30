import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import "./ProjectIDE.css";

export default function ProjectIDE() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncSending, setSyncSending] = useState(false);

  const editorRef = useRef(null);

  useEffect(() => {
    if (!user) return navigate("/login");
    api.get(`/projects/${id}`).then(res => {
      setProject(res.data);
      setCode(res.data.codeSnippet || "");
      setLoading(false);
    }).catch(() => {
      navigate("/");
    });
  }, [id, user, navigate]);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/projects/${id}`, { codeSnippet: code });
      alert("Code saved successfully!");
    } catch (err) {
      alert("Error saving: " + err.message);
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
              <h4>Project Info</h4>
              <p className="sidebar-desc">{project.description}</p>
            </div>
            {isRemix && (
              <div className="sidebar-section">
                <h4>Original Source</h4>
                <p>Remixed from: <strong>{project.remixedFrom.title || "Unknown"}</strong></p>
                <div className="sidebar-hint">
                  <p><strong>Pull</strong> to fetch their latest changes.</p>
                  <p><strong>Push</strong> to propose your edits to them natively.</p>
                </div>
              </div>
            )}
         </div>
         <div className="ide-editor-wrapper">
           <Editor
             height="100%"
             defaultLanguage="javascript"
             theme="vs-dark"
             value={code}
             onChange={(value) => setCode(value)}
             onMount={handleEditorDidMount}
             options={{
               minimap: { enabled: false },
               fontSize: 15,
               wordWrap: "on",
               fontFamily: "'Fira Code', 'Courier New', monospace"
             }}
           />
         </div>
      </div>
    </div>
  );
}
