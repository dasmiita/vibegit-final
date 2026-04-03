import { useRef, useState, useEffect, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";

export default function PullSwitch({ inline = false }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const [angle, setAngle] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState(false);
  const angleRef = useRef(0), velRef = useRef(0), rafRef = useRef(null);
  const triggeredRef = useRef(false), dragStartY = useRef(null);

  const springBack = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const tick = () => {
      velRef.current += -0.16 * angleRef.current;
      velRef.current *= 0.74;
      angleRef.current += velRef.current;
      if (Math.abs(angleRef.current) < 0.08 && Math.abs(velRef.current) < 0.08) {
        angleRef.current = 0; velRef.current = 0; setAngle(0); return;
      }
      setAngle(angleRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleMouseEnter = () => {
    if (pulling) return;
    cancelAnimationFrame(rafRef.current);
    velRef.current = 4; springBack();
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    triggeredRef.current = false;
    setPulling(true);
    cancelAnimationFrame(rafRef.current);
  };

  useEffect(() => {
    if (!pulling) return;
    const onMove = (e) => {
      const dy = e.clientY - dragStartY.current;
      const dx = e.clientX - (window.innerWidth - 52);
      const tilt = Math.max(-28, Math.min(28, dx * 0.35));
      angleRef.current = tilt; setAngle(tilt);
      if (dy > 55 && !triggeredRef.current) {
        triggeredRef.current = true; toggle();
        setFlash(true); setTimeout(() => setFlash(false), 350);
        velRef.current = -10;
      }
    };
    const onUp = () => { setPulling(false); dragStartY.current = null; springBack(); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [pulling, toggle, springBack]);

  const CORD = 68, rad = (angle * Math.PI) / 180;
  const ex = 50 + Math.sin(rad) * CORD, ey = 8 + Math.cos(rad) * CORD;
  const glowColor = isDark ? "rgba(255,240,80,0.55)" : "rgba(255,240,80,0.0)";
  const bulbFill = isDark ? "#fffde0" : "#e8e0f8";
  const bulbStroke = isDark ? "#c8a820" : "#9880cc";
  const cordColor = isDark ? "#d4c8f0" : "#8878b0";
  const socketFill = isDark ? "#4a4060" : "#9880cc";
  const filament = isDark ? "#ffd700" : "#c8a820";

  return (
    <>
      {flash && <div style={{ position:"fixed", inset:0, zIndex:9998, pointerEvents:"none", background:"rgba(255,250,180,0.15)", animation:"ps-flash 0.35s ease-out forwards" }} />}
      <style>{`@keyframes ps-flash { from{opacity:1} to{opacity:0} }`}</style>
      <div
        style={inline ? { position:"relative", width:72, height:58, flexShrink:0, pointerEvents:"all", userSelect:"none", overflow:"visible" }
          : { position:"fixed", top:0, right:28, width:104, height:130, zIndex:9999, pointerEvents:"all", userSelect:"none" }}
        onMouseEnter={handleMouseEnter} onPointerDown={handlePointerDown}
      >
        <svg viewBox="0 0 100 130" style={{ width:inline?72:"100%", height:inline?80:"100%", overflow:"visible", cursor:pulling?"grabbing":"grab",
          filter: isDark ? "drop-shadow(0 0 10px rgba(255,240,80,0.3)) drop-shadow(0 4px 8px rgba(0,0,0,0.4))" : "drop-shadow(0 4px 10px rgba(0,0,0,0.2))" }}>
          <rect x="41" y="0" width="18" height="5" rx="2" fill={isDark?"#3a3a4a":"#b0a8c8"} />
          <rect x="46" y="4" width="8" height="5" rx="1" fill={isDark?"#2a2a3a":"#9888b8"} />
          <line x1="50" y1="9" x2={ex} y2={ey} stroke={cordColor} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx={ex} cy={ey} r="5.5" fill="none" stroke={cordColor} strokeWidth="2" />
          <circle cx={ex} cy={ey} r="2.8" fill={isDark?"#c4b0f0":"#9880cc"} />
          <rect x={ex-7} y={ey+5} width="14" height="8" rx="2.5" fill={socketFill} />
          <rect x={ex-5} y={ey+12} width="10" height="3" rx="1" fill={isDark?"#3a3050":"#8060aa"} />
          {isDark && <ellipse cx={ex} cy={ey+30} rx="18" ry="20" fill={glowColor} />}
          <ellipse cx={ex} cy={ey+28} rx="12" ry="14" fill={bulbFill} stroke={bulbStroke} strokeWidth="1.5" />
          <path d={`M${ex-4} ${ey+24} Q${ex} ${ey+19} ${ex+4} ${ey+24} Q${ex} ${ey+29} ${ex-4} ${ey+33}`} fill="none" stroke={filament} strokeWidth="1.3" strokeLinecap="round" opacity={isDark?1:0.45} />
          <rect x={ex-7} y={ey+41} width="14" height="3" rx="1" fill={socketFill} />
          <rect x={ex-5} y={ey+44} width="10" height="3" rx="1" fill={isDark?"#3a3050":"#8060aa"} />
        </svg>
      </div>
    </>
  );
}
