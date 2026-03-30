import { useEffect, useState } from "react";
import "./Toast.css";

const ICONS = {
  success: "✅",
  error:   "❌",
  info:    "💡",
  warning: "⚠️",
  pending: "⏳",
};

export default function Toast({ toasts, dismiss }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast-card toast-${t.type || "info"}`}>
          <div className="toast-icon">{ICONS[t.type] || ICONS.info}</div>
          <div className="toast-body">
            {t.title && <p className="toast-title">{t.title}</p>}
            <p className="toast-message">{t.message}</p>
          </div>
          <button className="toast-close" onClick={() => dismiss(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// Hook to manage toasts
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = (message, type = "info", title = "") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, title }]);
    // Auto-dismiss after 4 seconds
    setTimeout(() => dismiss(id), 4000);
  };

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return { toasts, show, dismiss };
}
