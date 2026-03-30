import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import "./ActivityFeed.css";

const BASE = "http://localhost:5000/uploads/";

const ACTION_TEXT = {
  created:        (a) => <>created a new project <ProjectLink a={a} /></>,
  liked:          (a) => <>liked <ProjectLink a={a} /></>,
  remixed:        (a) => <>remixed <ProjectLink a={a} /> {a.meta ? `from "${a.meta}"` : ""}</>,
  followed:       ()  => <>followed someone</>,
  commented:      (a) => <>commented on <ProjectLink a={a} /></>,
  sync_requested: (a) => <>requested a sync for <ProjectLink a={a} /> {a.meta ? `from "${a.meta}"` : ""}</>,
  sync_approved:  (a) => <>approved a sync — <ProjectLink a={a} /> was updated</>
};

function ProjectLink({ a }) {
  if (!a.projectId) return null;
  return (
    <Link to={`/projects/${a.projectId._id}`} className="activity-project-link">
      {a.projectId.title}
    </Link>
  );
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/activity")
      .then(res => setActivities(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="activity-page">
      <h1 className="page-title">Activity</h1>
      {loading ? (
        <p className="loading">Loading activity...</p>
      ) : activities.length === 0 ? (
        <p className="empty">No activity yet. Start creating projects!</p>
      ) : (
        <div className="activity-list">
          {activities.map(a => {
            const username = a.userId?.username || "Someone";
            const userId = a.userId?._id;
            const avatarUrl = a.userId?.avatar ? `${BASE}${a.userId.avatar}` : null;
            const actionFn = ACTION_TEXT[a.type];

            return (
              <div key={a._id} className="activity-item">
                <div className="activity-avatar">
                  {avatarUrl
                    ? <img src={avatarUrl} alt="" />
                    : <div className="activity-avatar-placeholder">{username[0].toUpperCase()}</div>
                  }
                </div>
                <div className="activity-body">
                  <p className="activity-text">
                    <Link to={`/profile/${userId}`} className="activity-user">@{username}</Link>
                    {" "}{actionFn ? actionFn(a) : a.type}
                  </p>
                  <span className="activity-time">{timeAgo(a.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
