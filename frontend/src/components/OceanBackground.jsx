import { useEffect, useRef } from "react";

export default function OceanBackground({ active }) {
  const canvasRef = useRef(null);
  const depthRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const bubbles = Array.from({ length: 40 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random()*3+1,
      speed: Math.random()*0.0004+0.0002, wobble: Math.random()*Math.PI*2, wobbleS: Math.random()*0.02+0.01,
    }));
    let t = 0;
    const draw = () => {
      const cw = canvas.width, ch = canvas.height, d = depthRef.current; t++;
      const sky = ctx.createLinearGradient(0, 0, 0, ch);
      if (d < 0.15) {
        const p = d/0.15;
        sky.addColorStop(0, `hsl(${200-p*10},${60+p*20}%,${70-p*20}%)`);
        sky.addColorStop(0.4, `hsl(195,70%,${55-p*15}%)`);
        sky.addColorStop(1, `hsl(200,75%,${45-p*10}%)`);
      } else if (d < 0.5) {
        const p = (d-0.15)/0.35;
        sky.addColorStop(0, `hsl(${190-p*10},80%,${50-p*20}%)`);
        sky.addColorStop(0.5, `hsl(${200-p*10},80%,${40-p*15}%)`);
        sky.addColorStop(1, `hsl(${210-p*5},75%,${30-p*10}%)`);
      } else if (d < 0.8) {
        const p = (d-0.5)/0.3;
        sky.addColorStop(0, `hsl(${210-p*10},75%,${25-p*12}%)`);
        sky.addColorStop(0.5, `hsl(${215-p*5},70%,${18-p*8}%)`);
        sky.addColorStop(1, `hsl(220,65%,${12-p*5}%)`);
      } else {
        const p = (d-0.8)/0.2;
        sky.addColorStop(0, `hsl(220,60%,${8-p*6}%)`);
        sky.addColorStop(1, `hsl(225,55%,${4-p*3}%)`);
      }
      ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch);
      const rayOpacity = Math.max(0, 1-d*2.5)*0.12;
      if (rayOpacity > 0.005) {
        for (let i = 0; i < 6; i++) {
          const rx = cw*(0.1+i*0.16+Math.sin(t*0.003+i)*0.04);
          const rg = ctx.createLinearGradient(rx, 0, rx+60, ch*0.7);
          rg.addColorStop(0, `rgba(180,230,255,${rayOpacity})`); rg.addColorStop(1, "transparent");
          ctx.beginPath(); ctx.moveTo(rx,0); ctx.lineTo(rx+80,ch*0.7); ctx.lineTo(rx-20,ch*0.7);
          ctx.closePath(); ctx.fillStyle = rg; ctx.fill();
        }
      }
      const bubbleOpacity = Math.min(1, Math.max(0, (d-0.2)*3));
      if (bubbleOpacity > 0.01) {
        bubbles.forEach(b => {
          b.y -= b.speed; b.wobble += b.wobbleS;
          if (b.y < -0.05) b.y = 1.05;
          const bx = (b.x+Math.sin(b.wobble)*0.015)*cw, by = b.y*ch;
          ctx.beginPath(); ctx.arc(bx, by, b.r, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(180,230,255,${bubbleOpacity*0.5})`; ctx.lineWidth = 0.8; ctx.stroke();
          ctx.beginPath(); ctx.arc(bx-b.r*0.3, by-b.r*0.3, b.r*0.3, 0, Math.PI*2);
          ctx.fillStyle = `rgba(255,255,255,${bubbleOpacity*0.3})`; ctx.fill();
        });
      }
      const vig = ctx.createRadialGradient(cw/2,ch/2,ch*0.2,cw/2,ch/2,ch*0.9);
      vig.addColorStop(0,"transparent"); vig.addColorStop(1,`rgba(0,10,30,${d*0.55})`);
      ctx.fillStyle = vig; ctx.fillRect(0,0,cw,ch);
      requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); };
  }, []);

  useEffect(() => {
    const target = active ? 1 : 0;
    const step = () => {
      const diff = target - depthRef.current;
      if (Math.abs(diff) < 0.002) { depthRef.current = target; return; }
      depthRef.current += diff * 0.018;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active]);

  return <canvas ref={canvasRef} style={{ position:"fixed", inset:0, width:"100%", height:"100%", zIndex:0, pointerEvents:"none", opacity:active?1:0, transition:"opacity 1.2s ease" }} aria-hidden />;
}
