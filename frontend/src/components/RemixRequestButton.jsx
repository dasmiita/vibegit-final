import React, { useState } from 'react';
import { sendRemixRequest } from '../api/remixApi';

const RemixRequestButton = ({ projectId, initialStatus }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(initialStatus === 'pending' ? 'pending' : 'idle');
  const [errorMsg, setErrorMsg] = useState("");

  const handleRequest = async () => {
    if (status === 'pending') return;
    setLoading(true);
    setErrorMsg("");
    try {
      await sendRemixRequest(projectId);
      setStatus('pending');
    } catch (err) {
      if (err.response?.data?.message === "Request already exists") {
        setStatus("pending");
      } else {
        setErrorMsg(err.response?.data?.message || 'Request failed');
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === 'pending') {
    return (
      <button 
        className="remix-btn" 
        disabled 
        style={{ background: "#ffbd2e", color: "#000", border: "none", cursor: "not-allowed" }}
        title="Request Sent Successfully"
      >
        ⏳ Pending Approval
      </button>
    );
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
      <button 
        className="remix-btn pr-btn" 
        onClick={handleRequest} 
        disabled={loading}
        title="Ask the creator for permission to branch this project"
      >
        {loading ? "Sending..." : "🔁 Request Remix"}
      </button>
      {errorMsg && (
        <span style={{ position: "absolute", top: "100%", marginTop: "4px", fontSize: "11px", color: "#ff5f56", whiteSpace: "nowrap" }}>
          {errorMsg}
        </span>
      )}
    </div>
  );
};

export default RemixRequestButton;
