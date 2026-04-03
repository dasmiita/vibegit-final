import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import ProjectCard from "../components/ProjectCard";
import "./Feed.css";

export default function Feed() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/projects")
      .then(res => setProjects(res.data))
      .catch(err => setError(err.response?.data?.message || "Failed to load."))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = (id) => setProjects(prev => prev.filter(p => p._id !== id));

  return (
    <div className="feed-page">
      <h1 className="page-title">Feed</h1>
      {loading ? (
        <p className="loading">Loading...</p>
      ) : error ? (
        <p className="loading" style={{ color: "var(--like)" }}>{error}</p>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: "4rem" }}>
          <p className="empty">No projects yet.</p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-faint)", marginTop: "0.5rem" }}>
            Create a project or follow other developers to see their work here.
          </p>
        </div>
      ) : (
        <div className="feed-list">
          {projects.map(p => (
            <ProjectCard key={p._id} project={p} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
