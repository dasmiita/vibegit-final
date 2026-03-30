import React, { useState } from "react";
import "./CollaborationHub.css";

const CollaborationHub = ({ project, user, onPull, onPush, isOwner, syncSending, syncRequestSent }) => {
  const [terminalOutput, setTerminalOutput] = useState([
    "VibeGit v2.0 - Collaboration Terminal",
    "Initializing git environment...",
    "Connected to remote: upstream v1.0.4",
  ]);

  const addOutput = (line) => {
    setTerminalOutput((prev) => [...prev.slice(-4), `> ${line}`]);
  };

  const isRemix = !!project.remixedFrom;

  const handleAction = async (type) => {
    if (type === "pull") {
      addOutput("git fetch upstream...");
      addOutput("git merge upstream/main...");
      await onPull();
      addOutput("Successfully updated from original!");
    } else if (type === "push") {
      addOutput("git add . && git commit -m 'Update from branch'");
      addOutput("git push origin main...");
      await onPush();
      addOutput("Sync request sent to creator!");
    }
  };

  if (!isOwner || !isRemix) return null;

  return (
    <div className="collab-hub-container">
      <div className="collab-hub-card">
        <div className="hub-header">
          <div className="hub-dots">
            <span className="dot red"></span>
            <span className="dot yellow"></span>
            <span className="dot green"></span>
          </div>
          <span className="hub-title">Terminal: version-control</span>
        </div>
        
        <div className="hub-body">
          <div className="terminal-display">
            {terminalOutput.map((line, i) => (
              <div key={i} className="terminal-line">{line}</div>
            ))}
            <div className="terminal-cursor">_</div>
          </div>

          <div className="hub-actions-grid">
            <button 
              className="hub-action-btn pull" 
              onClick={() => handleAction("pull")}
              title="Pull latest changes from the original project"
            >
              <span className="icon">⬇️</span>
              <div className="text">
                <span className="main">Fetch & Pull</span>
                <span className="sub">Update from Original</span>
              </div>
            </button>

            <button 
              className="hub-action-btn push" 
              onClick={() => handleAction("push")}
              disabled={syncSending || syncRequestSent}
              title="Send your changes to the original creator"
            >
              <span className="icon">⬆️</span>
              <div className="text">
                <span className="main">{syncSending ? "Pushing..." : syncRequestSent ? "Pushed" : "Push & Sync"}</span>
                <span className="sub">Request Merge</span>
              </div>
            </button>
          </div>
          
          {syncRequestSent && (
            <div className="hub-status-bar success">
              <span className="pulse"></span>
              Sync request is pending review by @{project.remixedFrom?.userId?.username}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollaborationHub;
