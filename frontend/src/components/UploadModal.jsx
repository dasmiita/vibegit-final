import React from "react";
import "./UploadModal.css";

export default function UploadModal({ isOpen, files, skipped, progress, status, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="upload-modal-overlay">
      <div className="upload-modal-card">
        <div className="upload-modal-header">
          <h2>{status === "uploading" ? "🚀 Uploading Project..." : "✅ Project Uploaded!"}</h2>
          <p>{files.length} files identified for your project</p>
        </div>

        <div className="upload-stats">
          <div className="stat-item">
            <span className="stat-value">{files.length}</span>
            <span className="stat-label">Files Selected</span>
          </div>
          <div className="stat-item stat-skipped">
            <span className="stat-value">{skipped}</span>
            <span className="stat-label">Skipped (Safe)</span>
          </div>
        </div>

        <div className="upload-progress-container">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="progress-info">
            <span>{progress}% complete</span>
            {status === "uploading" && <span className="upload-status-pulse">Processing...</span>}
          </div>
        </div>

        {status === "error" && (
          <div className="upload-error-msg">
            Something went wrong. Please check your connection.
          </div>
        )}

        <div className="upload-modal-footer">
          {status === "uploading" ? (
            <button className="upload-cancel-btn" onClick={onCancel}>Cancel Upload</button>
          ) : (
            <button className="upload-done-btn">Finalizing...</button>
          )}
        </div>
      </div>
    </div>
  );
}
