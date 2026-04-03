import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";

export default function OceanTap({ active, onToggle }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [pressed, setPressed] = useState(false);
  const [drops, setDrops] = useState([]);

  useEffect(() => {
    if (!active) { setDrops([]); return; }
    const interval = setInterval(() => setDrops(prev => [...prev.slice(-5), { id: Date.now() }]), 380);
    return () => clearInterval(interval);
  }, [active]);

  const handleClick = () => { setPressed(true); setTimeout(() => setPressed(false), 180); onToggle(); };

  const pipeColor = isDark ? "#3a3a4a" : "#b0a8c8";
  const pipeShade = isDark ? "#2a2a3a" : "#9888b8";
  const handleFill = active ? (isDark ? "#7dd3fc" : "#38bdf8") : (isDark ? "#c4b0f0" : "#9880cc");
  const dropColor = isDark ? "#7dd3fc" : "#38bdf8";

  return (
    <div onClick={handleClick} title={active ? "Turn off ocean mode" : "Dive into the ocean 🌊"}
      style={{ position:"relative", width:44, height:58, flexShrink:0, cursor:"pointer", userSelect:"none", overflow:"visible" }}>
      <style>{`
        @keyframes ot-drop { 0%{transform:translateY(0) scale(1);opacity:0.85} 60%{transform:translateY(28px) scale(0.9);opacity:0.6} 100%{transform:translateY(48px) scale(0.5);opacity:0} }
        @keyframes ot-glow { 0%,100%{filter:drop-shadow(0 0 4px rgba(56,189,248,0.35))} 50%{filter:drop-shadow(0 0 10px rgba(56,189,248,0.7))} }
      `}</style>
      <svg viewBox="0 0 44 80" style={{ width:44, height:80, overflow:"visible",
        transform:pressed?"scale(0.93)":"scale(1)", transition:"transform 0.18s cubic-bezier(0.34,1.56,0.64,1)",
        animation:active?"ot-glow 2s ease-in-out infinite":"none",
        filter:!active?(isDark?"drop-shadow(0 4px 8px rgba(0,0,0,0.4))":"drop-shadow(0 4px 10px rgba(0,0,0,0.2))"):undefined }}>
        <rect x="16" y="0" width="12" height="5" rx="2" fill={pipeColor} />
        <rect x="19" y="4" width="6" height="4" rx="1" fill={pipeShade} />
        <rect x="20" y="8" width="4" height="22" rx="2" fill={pipeColor} />
        <rect x="12" y="26" width="20" height="6" rx="3" fill={pipeColor} />
        <rect x="10" y="30" width="6" height="16" rx="3" fill={pipeColor} />
        <rect x="8" y="44" width="10" height="3" rx="1.5" fill={pipeShade} />
        <rect x="28" y="27" width="12" height="4" rx="2" fill={handleFill} />
        <circle cx="40" cy="29" r="4.5" fill="none" stroke={handleFill} strokeWidth="2" />
        <circle cx="40" cy="29" r="2.2" fill={handleFill} />
        {active && <ellipse cx="13" cy="52" rx="5" ry="3" fill="rgba(56,189,248,0.45)" />}
        <rect x="8" y="20" width="4" height="5" rx="2" fill="rgba(255,255,255,0.25)" />
      </svg>
      {drops.map(drop => (
        <div key={drop.id} style={{ position:"absolute", left:10, top:46, width:4, height:7,
          borderRadius:"50% 50% 55% 55%", background:`linear-gradient(180deg,${dropColor}cc,${dropColor})`,
          animation:"ot-drop 0.85s ease-in forwards", pointerEvents:"none" }} />
      ))}
    </div>
  );
}
