import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import ProjectCard from "../components/ProjectCard";
import "./Explore.css";

const TAGS = ["AI", "Web", "Mobile", "Fun", "Design", "Game", "Tool", "Other"];

export default function Explore() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const search = params.get("search") || "";
  const tag = params.get("tag") || "";

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (tag) query.set("tag", tag);
    api.get(`/projects?${query.toString()}`)
      .then(res => setProjects(res.data))
      .finally(() => setLoading(false));
  }, [search, tag]);

  const setTag = (t) => {
    const q = new URLSearchParams(location.search);
    if (q.get("tag") === t) q.delete("tag");
    else q.set("tag", t);
    navigate(`/?${q.toString()}`);
  };

  const handleDelete = (id) => setProjects(prev => prev.filter(p => p._id !== id));

  return (
    <div className="explore-page">
      <div className="explore-header">
        <h1 className="page-title">
          {search ? `Results for "${search}"` : "Explore"}
        </h1>
        <div className="tag-filters">
          {TAGS.map(t => (
            <button
              key={t}
              className={`tag-filter-btn ${tag === t ? "active" : ""}`}
              onClick={() => setTag(t)}
            >
              #{t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="loading">Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className="empty">No projects found. Be the first to create one!</p>
      ) : (
        <div className="explore-grid">
          {projects.map(p => (
            <ProjectCard key={p._id} project={p} tile onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
