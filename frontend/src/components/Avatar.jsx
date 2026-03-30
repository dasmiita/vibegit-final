import React, { useState, useEffect } from "react";
import "./Avatar.css";

const BASE = "http://localhost:5000/uploads/";

export default function Avatar({ user, size = 40, className = "" }) {
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  const url = user?.avatar ? `${BASE}${user.avatar}` : null;
  const username = user?.username || "Unknown";
  const letter = username[0].toUpperCase();

  useEffect(() => {
    setImgError(false);
    setLoaded(false);
  }, [user?.id, user?.avatar]);

  if (url && !imgError) {
    return (
      <div className={`vibe-avatar-container ${className}`} style={{ width: size, height: size }}>
        {!loaded && (
          <div className="vibe-avatar-placeholder" style={{ fontSize: size * 0.4 }}>
            {letter}
          </div>
        )}
        <img
          src={url}
          alt={username}
          className={`vibe-avatar-img ${loaded ? "visible" : "hidden"}`}
          style={{ width: size, height: size }}
          onLoad={() => setLoaded(true)}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`vibe-avatar-placeholder ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {letter}
    </div>
  );
}
