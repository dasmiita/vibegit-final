import { useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";

function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function NightSky() {
  const canvasRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    let raf;

    if (theme === "light") {
      const rand = seededRand(99);
      const clouds = Array.from({ length: 3 }, () => ({
        x: rand() * 1.4 - 0.2, y: 0.1 + rand() * 0.28,
        w: 0.14 + rand() * 0.16, h: 0.03 + rand() * 0.04,
        speed: 0.000014 + rand() * 0.00002, alpha: 0.22 + rand() * 0.18,
        puffs: 2 + Math.floor(rand() * 2),
      }));
      const RAY_COUNT = 16;
      const rays = Array.from({ length: RAY_COUNT }, (_, i) => ({
        angle: (i / RAY_COUNT) * Math.PI * 2,
        len: 0.10 + rand() * 0.07, width: 1.2 + rand() * 2, alpha: 0.05 + rand() * 0.06,
      }));
      let t = 0;
      const drawCloud = (cw, ch, cloud) => {
        const x = cloud.x * cw, y = cloud.y * ch, w = cloud.w * cw, h = cloud.h * ch;
        ctx.save(); ctx.globalAlpha = cloud.alpha;
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.shadowColor = "rgba(255,200,120,0.12)"; ctx.shadowBlur = 8;
        const puffW = w / cloud.puffs;
        for (let p = 0; p < cloud.puffs; p++) {
          ctx.beginPath();
          ctx.arc(x + p * puffW + puffW * 0.5, y - h * (0.3 + Math.sin(p * 1.2) * 0.2), puffW * 0.52, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath(); ctx.roundRect(x, y - h * 0.3, w, h * 0.7, h * 0.3); ctx.fill();
        ctx.restore();
      };
      const draw = () => {
        const cw = canvas.width, ch = canvas.height; t++;
        const sky = ctx.createLinearGradient(0, 0, 0, ch);
        sky.addColorStop(0, "#fde8c8"); sky.addColorStop(0.25, "#fcd4a0");
        sky.addColorStop(0.50, "#fac898"); sky.addColorStop(0.72, "#fde0b0");
        sky.addColorStop(0.88, "#fef0d4"); sky.addColorStop(1, "#fffaf0");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch);
        const horizonY = ch * 0.72;
        const hGlow = ctx.createRadialGradient(cw*0.5, horizonY, 0, cw*0.5, horizonY, cw*0.42);
        hGlow.addColorStop(0, "rgba(255,210,140,0.12)"); hGlow.addColorStop(0.4, "rgba(255,180,80,0.04)"); hGlow.addColorStop(1, "transparent");
        ctx.fillStyle = hGlow; ctx.fillRect(0, 0, cw, ch);
        const sunX = cw * 0.5, sunY = ch * (0.64 + Math.sin(t * 0.0003) * 0.012), sunR = Math.min(cw, ch) * 0.048;
        rays.forEach(ray => {
          const len = ray.len * Math.min(cw, ch), x2 = sunX + Math.cos(ray.angle) * len, y2 = sunY + Math.sin(ray.angle) * len;
          const rg = ctx.createLinearGradient(sunX, sunY, x2, y2);
          rg.addColorStop(0, `rgba(255,220,80,${ray.alpha})`); rg.addColorStop(1, "transparent");
          ctx.beginPath(); ctx.moveTo(sunX, sunY); ctx.lineTo(x2, y2);
          ctx.strokeStyle = rg; ctx.lineWidth = ray.width * 0.65; ctx.stroke();
        });
        const halo = ctx.createRadialGradient(sunX, sunY, sunR*0.5, sunX, sunY, sunR*2.6);
        halo.addColorStop(0, "rgba(255,230,100,0.24)"); halo.addColorStop(0.4, "rgba(255,170,50,0.08)"); halo.addColorStop(1, "transparent");
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(sunX, sunY, sunR*2.6, 0, Math.PI*2); ctx.fill();
        const sunGrad = ctx.createRadialGradient(sunX-sunR*0.2, sunY-sunR*0.2, 0, sunX, sunY, sunR);
        sunGrad.addColorStop(0, "#fffde0"); sunGrad.addColorStop(0.5, "#ffe066"); sunGrad.addColorStop(1, "#ffb830");
        ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI*2); ctx.fillStyle = sunGrad; ctx.fill();
        clouds.forEach(cloud => { cloud.x += cloud.speed; if (cloud.x > 1.5) cloud.x = -0.4; drawCloud(cw, ch, cloud); });
        const fog = ctx.createLinearGradient(0, ch*0.92, 0, ch);
        fog.addColorStop(0, "transparent"); fog.addColorStop(1, "rgba(255,245,220,0.28)");
        ctx.fillStyle = fog; ctx.fillRect(0, ch*0.92, cw, ch*0.08);
        raf = requestAnimationFrame(draw);
      };
      draw();
    } else {
      const rand = seededRand(42);
      const stars = Array.from({ length: 280 }, () => ({
        bx: rand(), by: rand(), r: rand()*1.4+0.3, alpha: rand()*0.5+0.25,
        speed: rand()*0.018+0.006, phase: rand()*Math.PI*2,
        driftR: rand()*0.6+0.2, driftS: rand()*0.0004+0.0001, driftP: rand()*Math.PI*2,
        hue: rand() > 0.85 ? `hsl(${200+rand()*40},80%,90%)` : "#ffffff",
      }));
      const shooters = [];
      const spawnShooter = (cw, ch) => ({
        x: rand()*cw*0.7, y: rand()*ch*0.4, len: rand()*120+60,
        speed: rand()*6+5, angle: Math.PI/5+rand()*0.3, life: 1,
      });
      let t = 0, nextShooter = 180 + Math.floor(rand()*300);
      const draw = () => {
        const cw = canvas.width, ch = canvas.height; t++;
        const sky = ctx.createLinearGradient(0, 0, 0, ch);
        sky.addColorStop(0, "#010104"); sky.addColorStop(0.5, "#02020a"); sky.addColorStop(1, "#04030e");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch);
        const neb1 = ctx.createRadialGradient(cw*0.3, ch*0.25, 0, cw*0.3, ch*0.25, cw*0.35);
        neb1.addColorStop(0, "rgba(60,20,100,0.07)"); neb1.addColorStop(1, "transparent");
        ctx.fillStyle = neb1; ctx.fillRect(0, 0, cw, ch);
        const neb2 = ctx.createRadialGradient(cw*0.75, ch*0.55, 0, cw*0.75, ch*0.55, cw*0.28);
        neb2.addColorStop(0, "rgba(10,30,80,0.06)"); neb2.addColorStop(1, "transparent");
        ctx.fillStyle = neb2; ctx.fillRect(0, 0, cw, ch);
        stars.forEach(s => {
          const twinkle = s.alpha + Math.sin(t*s.speed+s.phase)*0.45;
          const sx = (s.bx + Math.cos(t*s.driftS+s.driftP)*s.driftR/cw)*cw;
          const sy = (s.by + Math.sin(t*s.driftS+s.driftP)*s.driftR/ch)*ch;
          ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, Math.PI*2);
          ctx.fillStyle = s.hue === "#ffffff" ? `rgba(255,255,255,${Math.max(0.04,twinkle)})` : s.hue.replace("hsl","hsla").replace(")",`,${Math.max(0.04,twinkle)})`);
          ctx.fill();
        });
        if (--nextShooter <= 0) { shooters.push(spawnShooter(cw, ch)); nextShooter = 200+Math.floor(rand()*400); }
        for (let i = shooters.length-1; i >= 0; i--) {
          const sh = shooters[i];
          sh.x += Math.cos(sh.angle)*sh.speed; sh.y += Math.sin(sh.angle)*sh.speed; sh.life -= 0.018;
          if (sh.life <= 0) { shooters.splice(i,1); continue; }
          const tx = sh.x-Math.cos(sh.angle)*sh.len, ty = sh.y-Math.sin(sh.angle)*sh.len;
          const grad = ctx.createLinearGradient(tx,ty,sh.x,sh.y);
          grad.addColorStop(0,"transparent"); grad.addColorStop(1,`rgba(255,255,255,${sh.life*0.8})`);
          ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(sh.x,sh.y);
          ctx.strokeStyle = grad; ctx.lineWidth = 1.2; ctx.stroke();
        }
        raf = requestAnimationFrame(draw);
      };
      draw();
    }
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [theme]);

  return <canvas ref={canvasRef} style={{ position:"fixed", inset:0, width:"100%", height:"100%", zIndex:0, pointerEvents:"none" }} aria-hidden />;
}
