import React, { useState } from "react";
import "./CollaborationHub.css";

const CollaborationHub = ({ project, user, onPull, onPush, isOwner, syncSending, syncRequestSent }) => {
  const [terminalOutput, setTerminalOutput] = useState([
    "✔ Connected to upstream",
    "Ready for secure collaboration operations."
  ]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  
  const isRemix = !!project.remixedFrom;

  const addOutput = (line) => {
    setTerminalOutput((prev) => [...prev.slice(-4), `> ${line}`]);
  };

  const handleActionClick = (type) => {
    if (type === "push") {
      setPendingAction("push");
      setShowConfirmModal(true);
    } else {
      executeAction("pull");
    }
  };

  const executeAction = async (type) => {
    setShowConfirmModal(false);
    
    if (type === "pull") {
      addOutput("Syncing updates from upstream...");
      try {
        await onPull();
        addOutput("✔ Updates synced successfully");
      } catch (err) {
        addOutput("❌ Sync failed — retry");
      }
    } else if (type === "push") {
      addOutput("Secure request initiated...");
      try {
        await onPush();
        addOutput("✔ Merge Request Sent");
      } catch (err) {
        addOutput("❌ Sync failed — retry");
      }
    }
  };

  if (!isOwner || !isRemix) return null;

  return (
    <div className="collab-hub-container" style={{ marginTop: "24px" }}>
      <div className="collab-hub-card" style={{ background: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
        <div className="hub-header" style={{ display: "flex", alignItems: "center", padding: "12px 16px", background: "rgba(0,0,0,0.2)", borderBottom: "1px solid var(--border)" }}>
          <div className="hub-dots" style={{ display: "flex", gap: "6px", marginRight: "12px" }}>
             <span className="dot" style={{width: 10, height: 10, borderRadius: '50%', background: '#ff5f56'}}></span>
             <span className="dot" style={{width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e'}}></span>
             <span className="dot" style={{width: 10, height: 10, borderRadius: '50%', background: '#27c93f'}}></span>
          </div>
          <span className="hub-title" style={{ color: 'var(--text-muted)', fontSize: "0.9rem", fontWeight: 600 }}>Live Status Feed</span>
        </div>
        
        <div className="hub-body" style={{ padding: "16px" }}>
          <div className="terminal-display" style={{ background: '#0d1117', color: '#c9d1d9', padding: '16px', borderRadius: '6px', fontFamily: "monospace", minHeight: "100px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            {terminalOutput.map((line, i) => (
              <div key={i} className="terminal-line" style={{ marginBottom: "6px", fontSize: "0.85rem" }}>{line}</div>
            ))}
            <div className="terminal-cursor" style={{ animation: "blink 1s step-end infinite", opacity: 0.8 }}>_</div>
          </div>

          <div className="hub-actions-grid" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button 
              className="hub-action-btn" 
              onClick={() => handleActionClick("pull")}
              style={{ flex: 1, padding: '16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text)", transition: "all 0.2s" }}
              onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            >
              <span className="icon" style={{ fontSize: "1.5rem" }}>⬇️</span>
              <div className="text" style={{ textAlign: "center", marginTop: "8px" }}>
                <span className="main" style={{ display: 'block', fontWeight: 'bold' }}>Sync Updates</span>
                <span className="sub" style={{ fontSize: '0.8rem', opacity: 0.7 }}>Pull latest from original</span>
              </div>
            </button>

            <button 
              className="hub-action-btn" 
              onClick={() => handleActionClick("push")}
              disabled={syncSending || syncRequestSent}
              style={{ flex: 1, padding: '16px', borderRadius: '8px', cursor: syncSending || syncRequestSent ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', background: syncRequestSent ? "rgba(39,201,63,0.1)" : "rgba(255,255,255,0.05)", border: syncRequestSent ? "1px solid #27c93f" : "1px solid var(--border)", color: "var(--text)", transition: "all 0.2s", opacity: syncSending ? 0.6 : 1 }}
              onMouseOver={(e) => { if(!syncSending && !syncRequestSent) e.currentTarget.style.background = "rgba(255,255,255,0.1)"}}
              onMouseOut={(e) => { if(!syncSending && !syncRequestSent) e.currentTarget.style.background = "rgba(255,255,255,0.05)"}}
            >
              <span className="icon" style={{ fontSize: "1.5rem" }}>⬆️</span>
              <div className="text" style={{ textAlign: "center", marginTop: "8px" }}>
                <span className="main" style={{ display: 'block', fontWeight: 'bold' }}>
                  {syncSending ? "Syncing..." : syncRequestSent ? "✔ Merge Request Sent" : "Request Merge"}
                </span>
                <span className="sub" style={{ fontSize: '0.8rem', opacity: 0.7 }}>Send changes to owner</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(4px)" }}>
          <div className="modal-content" style={{ background: "var(--bg-card, #1e1e1e)", padding: "32px", borderRadius: "12px", maxWidth: "450px", color: "var(--text, #fff)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ background: "rgba(255,189,46,0.2)", color: "#ffbd2e", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
                🔒
              </div>
              <h3 style={{ margin: 0, fontSize: "1.25rem" }}>Secure Request Confirmation</h3>
            </div>
            
            <p style={{ opacity: 0.8, fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "32px" }}>
              You are about to send a secure request to the project owner.<br/><br/>
              This ensures controlled collaboration and prevents unauthorized changes to the upstream branch.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowConfirmModal(false)}
                style={{ padding: "10px 20px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "var(--text, #fff)", cursor: "pointer", fontWeight: "600", transition: "all 0.2s" }}
                onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
              >
                Cancel
              </button>
              <button 
                onClick={() => executeAction(pendingAction)}
                style={{ padding: "10px 20px", borderRadius: "6px", border: "none", background: "var(--accent, #3b82f6)", color: "#fff", cursor: "pointer", fontWeight: "600", transition: "all 0.2s" }}
                onMouseOver={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
                onMouseOut={(e) => e.currentTarget.style.filter = "none"}
              >
                Confirm Secure Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborationHub;
