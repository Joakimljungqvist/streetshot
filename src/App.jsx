import { useEffect, useRef, useState } from "react";

const fl = document.createElement("link");
fl.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700;900&display=swap";
fl.rel = "stylesheet";
document.head.appendChild(fl);

const W = 400;
const H = 600;

export default function App() {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [highscore, setHighscore] = useState(()=>{
    try { return parseInt(localStorage.getItem("streetshot_hs")||"0"); }
    catch { return 0; }
  });
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const game = useRef({
    player: { x: 200, y: 500, facing: 0, walkCycle: 0, shootAnim: 0 },
    hoop: { x: 200, y: 90, dir: 1, speed: 1.5, ydir: 1, yspeed: 0.5, baseY: 90 },
    fallingBalls: [],
    shotBall: null,
    keys: { left: false, right: false },
    nextBallTime: 0,
    frame: 0,
    particles: [], // swish particles
    dustParticles: [], // dust under feet
    fireParticles: [], // fire when on combo
    shakeAmount: 0, // screen shake
  });

  const playSound = (type) => {
    try {
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === "swish") {
        osc.frequency.value = 700;
        osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === "catch") {
        osc.frequency.value = 200;
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === "miss") {
        osc.frequency.value = 160;
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === "drop") {
        osc.frequency.value = 100;
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === "bounce_soft") {
        osc.frequency.value = 250;
        gain.gain.setValueAtTime(0.015, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch(e) {}
  };

  const startGame = () => {
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setMisses(0);
    setTimeLeft(90);
    setStarted(true);
    setGameOver(false);
    setFeedback(null);
    game.current.player.x = 200;
    game.current.player.facing = 0;
    game.current.player.walkCycle = 0;
    game.current.player.shootAnim = 0;
    game.current.hoop.x = 200;
    game.current.hoop.y = 90;
    game.current.hoop.speed = 0.3;
    game.current.hoop.yspeed = 0.1;
    game.current.hoop.ydir = 1;
    game.current.fallingBalls = [];
    game.current.shotBall = null;
    game.current.nextBallTime = 0;
    game.current.frame = 0;
    game.current.particles = [];
    game.current.dustParticles = [];
    game.current.fireParticles = [];
    game.current.shakeAmount = 0;
  };

  const shoot = () => {
    if (game.current.shotBall) return;
    const px = game.current.player.x;
    let caughtIdx = -1;
    let closestDist = 9999;
    for (let i = 0; i < game.current.fallingBalls.length; i++) {
      const b = game.current.fallingBalls[i];
      const dx = Math.abs(b.x - px);
      const dy = Math.abs(b.y - 480);
      // Catch zone: horizontal 40px, vertical 80px around player
      if (dx < 40 && dy < 80) {
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < closestDist) {
          caughtIdx = i;
          closestDist = dist;
        }
      }
    }
    if (caughtIdx === -1) return;
    game.current.fallingBalls.splice(caughtIdx, 1);
    const hx = game.current.hoop.x;
    const hy = game.current.hoop.y;
    const dx = hx - px;
    const dy = hy - 480;
    const gravity = 0.3;
    const time = 35;
    const vx = dx / time;
    const vy = (dy - 0.5 * gravity * time * time) / time;
    game.current.shotBall = { x: px, y: 460, vx, vy };
    game.current.player.shootAnim = 20; // 20 frames of shoot animation
    playSound("catch");
  };

  // Countdown timer - 90 sec base + bonus at milestones
  useEffect(()=>{
    if (!started || gameOver) return;
    const t = setInterval(()=>{
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameOver(true);
          setStarted(false);
          setScore(currScore => {
            setHighscore(hs => {
              if (currScore > hs) {
                try { localStorage.setItem("streetshot_hs", String(currScore)); } catch(e) {}
                return currScore;
              }
              return hs;
            });
            return currScore;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return ()=>clearInterval(t);
  },[started, gameOver]);

  useEffect(()=>{
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft" || e.key === "a") game.current.keys.left = true;
      if (e.key === "ArrowRight" || e.key === "d") game.current.keys.right = true;
      if (e.key === " ") {
        e.preventDefault();
        if (started) shoot();
        else if (!gameOver) startGame();
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === "ArrowLeft" || e.key === "a") game.current.keys.left = false;
      if (e.key === "ArrowRight" || e.key === "d") game.current.keys.right = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return ()=>{
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  },[started, gameOver]);

  useEffect(()=>{
    if (!started) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationId;

    const draw = () => {
      game.current.frame++;
      const F = game.current.frame;
      const difficulty = Math.min(1, F / 7200); // ramp over 120 sec
      game.current.hoop.speed = 0.3 + difficulty * 0.8;
      game.current.hoop.yspeed = 0.1 + difficulty * 0.35;
      const ballInterval = Math.max(80, 150 - difficulty * 70);
      
      // Screen shake
      let shakeX = 0, shakeY = 0;
      if (game.current.shakeAmount > 0) {
        shakeX = (Math.random() - 0.5) * game.current.shakeAmount;
        shakeY = (Math.random() - 0.5) * game.current.shakeAmount;
        game.current.shakeAmount *= 0.85;
        if (game.current.shakeAmount < 0.5) game.current.shakeAmount = 0;
      }
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // ── NYC STREET BASKETBALL COURT - DAYTIME (ENHANCED) ──
      // Sky gradient (warm daylight, more dramatic)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 280);
      skyGrad.addColorStop(0, "#6ba8d8");
      skyGrad.addColorStop(0.4, "#9bc4e2");
      skyGrad.addColorStop(0.7, "#c8d8e8");
      skyGrad.addColorStop(1, "#e8d8c0");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, 280);
      
      // Soft clouds
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      const cloudOffset = (F * 0.15) % (W + 100);
      // Cloud 1
      const c1x = 60 - cloudOffset * 0.3;
      ctx.beginPath();
      ctx.arc(c1x, 40, 18, 0, Math.PI * 2);
      ctx.arc(c1x + 18, 38, 22, 0, Math.PI * 2);
      ctx.arc(c1x + 38, 42, 18, 0, Math.PI * 2);
      ctx.arc(c1x + 25, 50, 16, 0, Math.PI * 2);
      ctx.fill();
      // Cloud 2
      const c2x = 250 - cloudOffset * 0.2;
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.beginPath();
      ctx.arc(c2x, 65, 14, 0, Math.PI * 2);
      ctx.arc(c2x + 14, 60, 18, 0, Math.PI * 2);
      ctx.arc(c2x + 32, 65, 14, 0, Math.PI * 2);
      ctx.fill();
      // Cloud 3 (small, distant)
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      const c3x = 320 - cloudOffset * 0.1;
      ctx.beginPath();
      ctx.arc(c3x, 25, 10, 0, Math.PI * 2);
      ctx.arc(c3x + 12, 23, 14, 0, Math.PI * 2);
      ctx.arc(c3x + 26, 27, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Sun glow in upper right
      const sunGrad = ctx.createRadialGradient(W - 50, 40, 5, W - 50, 40, 140);
      sunGrad.addColorStop(0, "rgba(255, 245, 210, 0.8)");
      sunGrad.addColorStop(0.3, "rgba(255, 230, 170, 0.3)");
      sunGrad.addColorStop(1, "rgba(255, 210, 120, 0)");
      ctx.fillStyle = sunGrad;
      ctx.fillRect(W - 200, 0, 200, 200);
      // Sun core
      ctx.fillStyle = "#fff8dc";
      ctx.beginPath();
      ctx.arc(W - 50, 40, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Birds (small V shapes)
      ctx.strokeStyle = "rgba(40, 40, 50, 0.7)";
      ctx.lineWidth = 1.2;
      const birdOffset = (F * 0.3) % W;
      for (let i = 0; i < 3; i++) {
        const bx = ((i * 130) + birdOffset) % W;
        const by = 70 + i * 15;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + 3, by - 2, bx + 6, by);
        ctx.moveTo(bx + 6, by);
        ctx.quadraticCurveTo(bx + 9, by - 2, bx + 12, by);
        ctx.stroke();
      }
      
      // ── FAR BACKGROUND - Distant skyscrapers (hazy) ──
      ctx.fillStyle = "rgba(130, 125, 130, 0.55)";
      for (let i = 0; i < 9; i++) {
        const bx = i * 48;
        const bh = 90 + ((i * 41) % 80);
        ctx.fillRect(bx, 220 - bh, 44, bh);
        // Building top antenna
        if (i % 3 === 0) {
          ctx.fillRect(bx + 20, 220 - bh - 15, 2, 15);
        }
      }
      // Distant skyscraper windows
      ctx.fillStyle = "rgba(220, 210, 180, 0.55)";
      for (let i = 0; i < 50; i++) {
        const wx = (i * 13) % W;
        const wy = 150 + (i * 7) % 70;
        ctx.fillRect(wx, wy, 2, 3);
      }
      
      // ── MID BACKGROUND - Brownstone buildings ──
      ctx.fillStyle = "#a35a3c";
      for (let i = 0; i < 5; i++) {
        const bx = i * 85 - 5;
        const bh = 120 + ((i * 31) % 35);
        ctx.fillRect(bx, 280 - bh, 82, bh);
        // Building tops (slight roof line)
        ctx.fillStyle = "#7a3f28";
        ctx.fillRect(bx, 280 - bh - 3, 82, 4);
        ctx.fillStyle = "#a35a3c";
      }
      
      // Brick pattern on brownstones (more visible)
      ctx.strokeStyle = "rgba(60, 30, 20, 0.3)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const bx = i * 85 - 5;
        // Horizontal mortar lines
        for (let row = 0; row < 12; row++) {
          const y = 165 + row * 11;
          if (y < 280) {
            ctx.beginPath();
            ctx.moveTo(bx, y);
            ctx.lineTo(bx + 82, y);
            ctx.stroke();
          }
        }
        // Vertical mortar (offset per row)
        for (let row = 0; row < 12; row++) {
          const y = 165 + row * 11;
          const offset = (row % 2) * 20;
          for (let x = 0; x < 82; x += 40) {
            ctx.beginPath();
            ctx.moveTo(bx + x + offset, y);
            ctx.lineTo(bx + x + offset, y + 11);
            ctx.stroke();
          }
        }
      }
      
      // Building windows (with frames)
      for (let i = 0; i < 5; i++) {
        const bx = i * 85 - 5;
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            const wx = bx + 12 + col * 22;
            const wy = 178 + row * 28;
            // Window frame
            ctx.fillStyle = "#1a0f08";
            ctx.fillRect(wx - 1, wy - 1, 14, 20);
            // Window glass
            ctx.fillStyle = "#3a2818";
            ctx.fillRect(wx, wy, 12, 18);
            // Reflection (light from sky)
            const grad2 = ctx.createLinearGradient(wx, wy, wx + 12, wy + 18);
            grad2.addColorStop(0, "rgba(255, 240, 200, 0.8)");
            grad2.addColorStop(0.5, "rgba(180, 200, 220, 0.3)");
            grad2.addColorStop(1, "rgba(80, 100, 120, 0.2)");
            ctx.fillStyle = grad2;
            ctx.fillRect(wx, wy, 12, 18);
            // Window cross
            ctx.strokeStyle = "rgba(20, 10, 5, 0.4)";
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(wx + 6, wy);
            ctx.lineTo(wx + 6, wy + 18);
            ctx.moveTo(wx, wy + 9);
            ctx.lineTo(wx + 12, wy + 9);
            ctx.stroke();
            // Window sill
            ctx.fillStyle = "#5a3020";
            ctx.fillRect(wx - 2, wy + 18, 16, 2);
          }
        }
      }
      
      // Fire escapes (metal staircases on buildings)
      ctx.strokeStyle = "#2a2a2a";
      ctx.fillStyle = "#1a1a1a";
      ctx.lineWidth = 1;
      [70, 240].forEach(fx => {
        // Vertical rails
        ctx.fillRect(fx, 175, 2, 90);
        ctx.fillRect(fx + 18, 175, 2, 90);
        // Horizontal platforms
        for (let py = 200; py < 270; py += 28) {
          ctx.fillRect(fx, py, 20, 2);
        }
        // Diagonal ladders
        ctx.strokeStyle = "#2a2a2a";
        for (let py = 200; py < 250; py += 28) {
          ctx.beginPath();
          ctx.moveTo(fx + 2, py);
          ctx.lineTo(fx + 18, py + 26);
          ctx.stroke();
        }
      });
      
      // Trees behind fence (urban park trees)
      const drawTree = (tx, ty, size) => {
        // Trunk
        ctx.fillStyle = "#3a2818";
        ctx.fillRect(tx - 2, ty, 4, size * 0.4);
        // Foliage (multiple circles)
        const foliage = ctx.createRadialGradient(tx, ty - size*0.3, 5, tx, ty - size*0.3, size);
        foliage.addColorStop(0, "#5a8c3a");
        foliage.addColorStop(1, "#2a4a1a");
        ctx.fillStyle = foliage;
        ctx.beginPath();
        ctx.arc(tx - size*0.4, ty - size*0.2, size * 0.5, 0, Math.PI * 2);
        ctx.arc(tx + size*0.4, ty - size*0.2, size * 0.5, 0, Math.PI * 2);
        ctx.arc(tx, ty - size*0.5, size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      };
      drawTree(60, 290, 20);
      drawTree(W - 60, 290, 22);
      
      // Graffiti on building walls (more colorful)
      ctx.fillStyle = "#dc2626";
      ctx.font = "bold italic 20px sans-serif";
      ctx.textAlign = "left";
      ctx.save();
      ctx.translate(10, 255);
      ctx.rotate(-0.08);
      ctx.globalAlpha = 0.75;
      ctx.fillText("NYC", 0, 0);
      // Drip effect
      ctx.fillRect(15, 0, 2, 8);
      ctx.fillRect(35, 2, 2, 6);
      ctx.restore();
      
      ctx.fillStyle = "#2563eb";
      ctx.font = "bold italic 18px sans-serif";
      ctx.save();
      ctx.translate(W - 75, 245);
      ctx.rotate(0.06);
      ctx.globalAlpha = 0.75;
      ctx.fillText("KING", 0, 0);
      ctx.restore();
      
      // Small tag in middle
      ctx.fillStyle = "#facc15";
      ctx.font = "bold italic 12px sans-serif";
      ctx.save();
      ctx.translate(155, 260);
      ctx.rotate(-0.05);
      ctx.globalAlpha = 0.6;
      ctx.fillText("SS", 0, 0);
      ctx.restore();
      
      ctx.globalAlpha = 1;
      
      // Chain link fence (left and right court boundary - more detailed)
      ctx.strokeStyle = "rgba(140, 140, 140, 0.5)";
      ctx.lineWidth = 1;
      // Left fence diamond pattern
      for (let y = 285; y < 460; y += 8) {
        for (let x = 5; x < 38; x += 8) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 6, y + 6);
          ctx.moveTo(x + 6, y);
          ctx.lineTo(x, y + 6);
          ctx.stroke();
        }
      }
      // Right fence
      for (let y = 285; y < 460; y += 8) {
        for (let x = W - 38; x < W - 5; x += 8) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 6, y + 6);
          ctx.moveTo(x + 6, y);
          ctx.lineTo(x, y + 6);
          ctx.stroke();
        }
      }
      // Fence rails (top, middle, bottom)
      ctx.strokeStyle = "rgba(60, 60, 60, 0.7)";
      ctx.lineWidth = 2.5;
      [285, 370, 460].forEach(ry => {
        ctx.beginPath();
        ctx.moveTo(0, ry); ctx.lineTo(38, ry);
        ctx.moveTo(W-38, ry); ctx.lineTo(W, ry);
        ctx.stroke();
      });
      // Fence posts
      ctx.fillStyle = "#333";
      [5, 38, W-38, W-5].forEach(px2 => {
        ctx.fillRect(px2 - 1, 285, 3, 175);
      });
      
      // Street lamp posts (subtle on each side)
      ctx.fillStyle = "#1a1a1a";
      // Left lamp
      ctx.fillRect(45, 240, 2, 45);
      ctx.beginPath();
      ctx.arc(46, 240, 4, 0, Math.PI * 2);
      ctx.fill();
      // Right lamp
      ctx.fillRect(W - 47, 240, 2, 45);
      ctx.beginPath();
      ctx.arc(W - 46, 240, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // ── COURT FLOOR (asphalt/playground style) ──
      // Main asphalt with gradient
      const floorGrad = ctx.createLinearGradient(0, 460, 0, H);
      floorGrad.addColorStop(0, "#62584e");
      floorGrad.addColorStop(0.5, "#4f463d");
      floorGrad.addColorStop(1, "#3a3128");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, 460, W, H - 460);
      
      // Court paint (blue/green painted area)
      const courtPaint = ctx.createLinearGradient(0, 470, 0, H);
      courtPaint.addColorStop(0, "rgba(70, 130, 180, 0.35)");
      courtPaint.addColorStop(1, "rgba(50, 90, 140, 0.25)");
      ctx.fillStyle = courtPaint;
      ctx.fillRect(40, 470, W - 80, H - 470);
      
      // Key/paint area (free throw zone) - slight color difference
      ctx.fillStyle = "rgba(220, 140, 60, 0.15)";
      ctx.fillRect(W/2 - 50, 470, 100, 70);
      
      // Court lines (white painted, slightly worn)
      ctx.strokeStyle = "rgba(245, 245, 240, 0.85)";
      ctx.lineWidth = 3;
      // Top sideline (under hoop area)
      ctx.beginPath();
      ctx.moveTo(40, 470);
      ctx.lineTo(W - 40, 470);
      ctx.stroke();
      // Side lines down
      ctx.beginPath();
      ctx.moveTo(40, 470);
      ctx.lineTo(40, H);
      ctx.moveTo(W - 40, 470);
      ctx.lineTo(W - 40, H);
      ctx.stroke();
      // Key (paint) box
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W/2 - 50, 470);
      ctx.lineTo(W/2 - 50, 540);
      ctx.lineTo(W/2 + 50, 540);
      ctx.lineTo(W/2 + 50, 470);
      ctx.stroke();
      // Free throw arc
      ctx.beginPath();
      ctx.arc(W/2, 540, 50, Math.PI, 0);
      ctx.stroke();
      // Center stripe (slight)
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(245, 245, 240, 0.5)";
      ctx.beginPath();
      ctx.moveTo(40, 580);
      ctx.lineTo(W - 40, 580);
      ctx.stroke();
      
      // Asphalt texture (cracks and spots)
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      for (let i = 0; i < 35; i++) {
        const ax = (i * 31) % W;
        const ay = 470 + (i * 17) % (H - 470);
        ctx.fillRect(ax, ay, 2, 2);
      }
      // Subtle cracks
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(80, 510);
      ctx.lineTo(110, 525);
      ctx.lineTo(120, 540);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W - 90, 530);
      ctx.lineTo(W - 70, 545);
      ctx.lineTo(W - 60, 560);
      ctx.stroke();
      // Light flecks
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      for (let i = 0; i < 20; i++) {
        const ax = (i * 47) % W;
        const ay = 480 + (i * 23) % (H - 480);
        ctx.fillRect(ax, ay, 1, 1);
      }
      // Paint wear marks
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(60 + i * 35, 472, 4, 1);
      }



      // ── HOOP (PREMIUM basketball hoop) ──
      const hx = game.current.hoop.x;
      const hy = game.current.hoop.y;
      
      // Backboard support pole (from top, more 3D)
      // Pole shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(hx + 1, 0, 4, hy - 38);
      // Main pole
      const poleGrad = ctx.createLinearGradient(hx - 3, 0, hx + 3, 0);
      poleGrad.addColorStop(0, "#444");
      poleGrad.addColorStop(0.5, "#2a2a2a");
      poleGrad.addColorStop(1, "#1a1a1a");
      ctx.fillStyle = poleGrad;
      ctx.fillRect(hx - 3, 0, 6, hy - 38);
      // Pole highlight
      ctx.fillStyle = "#5a5a5a";
      ctx.fillRect(hx - 2, 0, 1, hy - 38);
      
      // Backboard - premium with multiple layers
      // Backboard back shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(hx - 44, hy - 36, 88, 38);
      // Main backboard panel
      const bbGrad = ctx.createLinearGradient(hx - 42, hy - 38, hx - 42, hy);
      bbGrad.addColorStop(0, "#ffffff");
      bbGrad.addColorStop(0.5, "#f0f0f0");
      bbGrad.addColorStop(1, "#dadada");
      ctx.fillStyle = bbGrad;
      ctx.fillRect(hx - 42, hy - 38, 84, 36);
      // Backboard glass reflection (subtle diagonal)
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.beginPath();
      ctx.moveTo(hx - 42, hy - 38);
      ctx.lineTo(hx - 20, hy - 38);
      ctx.lineTo(hx - 40, hy - 18);
      ctx.lineTo(hx - 42, hy - 18);
      ctx.closePath();
      ctx.fill();
      // Backboard frame (metallic)
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 3;
      ctx.strokeRect(hx - 42, hy - 38, 84, 36);
      // Inner frame highlight
      ctx.strokeStyle = "#5a5a5a";
      ctx.lineWidth = 1;
      ctx.strokeRect(hx - 41, hy - 37, 82, 34);
      
      // Target square (orange/red, painted)
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 3.5;
      ctx.strokeRect(hx - 15, hy - 30, 30, 19);
      // Inner target line
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 1;
      ctx.strokeRect(hx - 13, hy - 28, 26, 15);
      
      // Logo on backboard (subtle "SS")
      ctx.fillStyle = "rgba(220, 38, 38, 0.4)";
      ctx.font = "bold italic 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SS", hx, hy - 7);
      
      // Rim mounting bracket (3D)
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(hx - 8, hy - 5, 16, 6);
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(hx - 7, hy - 4, 14, 1);
      
      // Rim back (dark for depth)
      ctx.strokeStyle = "#8a3000";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(hx, hy + 2, 27, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Main rim (orange)
      ctx.strokeStyle = "#dc6200";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(hx, hy, 26, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Rim highlight
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(hx, hy - 1, 25, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Rim shine (top)
      ctx.strokeStyle = "#ffba70";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(hx, hy - 2, 24, 5, 0, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      
      // Net (detailed mesh)
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1.2;
      const netDepth = 28;
      // Vertical strings
      for (let i = -25; i <= 25; i += 3.5) {
        ctx.beginPath();
        ctx.moveTo(hx + i, hy);
        ctx.quadraticCurveTo(hx + i * 0.75, hy + netDepth/2, hx + i * 0.5, hy + netDepth);
        ctx.stroke();
      }
      // Net horizontal weaves (3 levels)
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      [9, 18, 26].forEach((yOff, idx) => {
        const radiusX = 23 - idx * 4;
        const radiusY = 3.5 - idx * 0.8;
        ctx.beginPath();
        ctx.ellipse(hx, hy + yOff, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Spawn falling balls - from sides with proper horizontal speed
      if (F >= game.current.nextBallTime) {
        const fromLeft = Math.random() < 0.5;
        game.current.fallingBalls.push({
          x: fromLeft ? 20 : W - 20,
          y: -20 + Math.random() * 40,
          vx: fromLeft ? (0.8 + Math.random() * 1.2) : -(0.8 + Math.random() * 1.2),
          vy: 0.2 + Math.random() * 0.3 + difficulty * 0.5,
          rot: 0,
          rotSpeed: (Math.random() - 0.5) * 0.1,
        });
        game.current.nextBallTime = F + ballInterval + Math.random() * 15;
      }

      // Update falling balls - with bouncing physics
      for (let i = game.current.fallingBalls.length - 1; i >= 0; i--) {
        const b = game.current.fallingBalls[i];
        
        // Apply gravity (slower fall)
        b.vy += 0.05;
        if (b.vy > 4) b.vy = 4;
        
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.rotSpeed;
        
        // SAFETY: clamp ball position so it cannot escape screen
        if (b.x < 12) { b.x = 12; b.vx = Math.abs(b.vx) * 0.85; }
        if (b.x > W - 12) { b.x = W - 12; b.vx = -Math.abs(b.vx) * 0.85; }
        
        // Bounce off left wall
        if (b.x <= 12 && b.vx < 0) {
          b.vx = -b.vx * 0.85;
          playSound("bounce_soft");
        }
        // Bounce off right wall
        if (b.x >= W - 12 && b.vx > 0) {
          b.vx = -b.vx * 0.85;
          playSound("bounce_soft");
        }
        
        // Bounce off ground - capped bounce so balls don't fly to ceiling
        if (b.y > 540) {
          b.y = 540;
          // Cap the incoming velocity before bouncing to prevent ceiling shots
          const cappedVy = Math.min(Math.abs(b.vy), 4.5);
          b.vy = -cappedVy * 0.5;
          b.vx *= 0.85;
          if (Math.abs(b.vy) < 1.2) {
            // Ball lost energy, count as miss and remove
            game.current.fallingBalls.splice(i, 1);
            playSound("drop");
            setMisses(m => m + 1);
            setCombo(0);
            game.current.currentCombo = 0;
            continue;
          }
        }
        
        // Bounce off ceiling
        if (b.y < 15) {
          b.y = 15;
          b.vy = Math.abs(b.vy) * 0.85;
        }
        
        // Ground shadow (separate from ball, on the floor)
        const groundY = 555;
        const heightAboveGround = groundY - b.y;
        const shadowSize = Math.max(3, 10 - heightAboveGround / 80);
        const shadowAlpha = Math.max(0.05, 0.4 - heightAboveGround / 1500);
        ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(b.x, groundY, shadowSize, shadowSize * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw ball - realistic basketball
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        // Shadow under ball
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(0, 12, 8, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Main ball (orange-brown)
        const ballGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 10);
        ballGrad.addColorStop(0, "#e76d1f");
        ballGrad.addColorStop(0.7, "#cc5500");
        ballGrad.addColorStop(1, "#8a3800");
        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        // Basketball lines (curved)
        ctx.strokeStyle = "#1a0a00";
        ctx.lineWidth = 1.2;
        // Vertical curve (left)
        ctx.beginPath();
        ctx.arc(0, 0, 10, -Math.PI/2 - 0.3, Math.PI/2 + 0.3);
        ctx.stroke();
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        // Curve right
        ctx.beginPath();
        ctx.arc(0, 0, 10, Math.PI/2 - 0.3, Math.PI*1.5 + 0.3);
        ctx.stroke();
        // Highlight
        ctx.fillStyle = "rgba(255, 200, 150, 0.4)";
        ctx.beginPath();
        ctx.arc(-3, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Player - animated!
      const px = game.current.player.x;
      const py = game.current.player.y;
      const facing = game.current.player.facing;
      const isMoving = game.current.keys.left || game.current.keys.right;
      const shootAnim = game.current.player.shootAnim;
      const isShoot = shootAnim > 0;
      
      // Update animation counters
      if (isMoving) {
        game.current.player.walkCycle += 0.25;
      } else {
        game.current.player.walkCycle *= 0.85;
      }
      if (game.current.keys.left) game.current.player.facing = -1;
      else if (game.current.keys.right) game.current.player.facing = 1;
      if (shootAnim > 0) game.current.player.shootAnim--;
      
      const walk = game.current.player.walkCycle;
      const breath = Math.sin(F * 0.05) * 1.2;
      const legSwing = isMoving ? Math.sin(walk) * 6 : 0;
      const armSwing = isMoving ? Math.sin(walk) * 4 : 0;
      const bodyBob = isMoving ? Math.abs(Math.sin(walk * 2)) * 2 : breath;
      const lean = facing * (isMoving ? 2 : 0);
      
      // Shoot animation
      const shootProgress = isShoot ? (20 - shootAnim) / 20 : 0;
      const armRaise = Math.sin(shootProgress * Math.PI) * 38;
      
      // Skin color (more natural)
      const SKIN = "#b8835a";
      const SKIN_SHADE = "#8a5d3a";
      const HOODIE = "#0f0f0f";
      const HOODIE_SHADE = "#050505";
      const HOODIE_HIGHLIGHT = "#1f1f1f";
      
      // Shadow on ground
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(px, py + 51, 24, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.save();
      ctx.translate(px + lean, py + bodyBob);
      
      // ── LEGS (shorts visible + legs) ──
      // Shorts (basketball shorts, longer)
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(-16, 18, 32, 14);
      // White stripe on shorts
      ctx.fillStyle = "#fff";
      ctx.fillRect(-16, 22, 32, 2);
      // Left leg (skin)
      ctx.fillStyle = SKIN;
      ctx.fillRect(-13, 30 - legSwing, 10, 16 + legSwing);
      // Right leg
      ctx.fillRect(3, 30 + legSwing, 10, 16 - legSwing);
      // Leg shading
      ctx.fillStyle = SKIN_SHADE;
      ctx.fillRect(-13, 30 - legSwing, 2, 16 + legSwing);
      ctx.fillRect(3, 30 + legSwing, 2, 16 - legSwing);
      // Socks (white, high)
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(-14, 42 - legSwing, 12, 6);
      ctx.fillRect(2, 42 + legSwing, 12, 6);
      // Sock stripes
      ctx.fillStyle = "#f97316";
      ctx.fillRect(-14, 43 - legSwing, 12, 1);
      ctx.fillRect(2, 43 + legSwing, 12, 1);
      // Sneakers (Air Jordan style)
      ctx.fillStyle = "#fff";
      ctx.fillRect(-16, 47 - legSwing, 15, 5);
      ctx.fillRect(1, 47 + legSwing, 15, 5);
      // Sneaker dark accent (toe)
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(-3, 47 - legSwing, 2, 5);
      ctx.fillRect(13, 47 + legSwing, 2, 5);
      // Swoosh
      ctx.fillStyle = "#f97316";
      ctx.fillRect(-10, 48 - legSwing, 4, 1);
      ctx.fillRect(6, 48 + legSwing, 4, 1);
      
      // ── BODY (hoodie) ──
      // Main hoodie
      ctx.fillStyle = HOODIE;
      ctx.beginPath();
      ctx.moveTo(-22, -8);
      ctx.lineTo(22, -8);
      ctx.lineTo(20, 25);
      ctx.lineTo(-20, 25);
      ctx.closePath();
      ctx.fill();
      // Hoodie shading on right side
      ctx.fillStyle = HOODIE_SHADE;
      ctx.beginPath();
      ctx.moveTo(15, -8);
      ctx.lineTo(22, -8);
      ctx.lineTo(20, 25);
      ctx.lineTo(13, 25);
      ctx.closePath();
      ctx.fill();
      // Hoodie highlight (left side)
      ctx.fillStyle = HOODIE_HIGHLIGHT;
      ctx.fillRect(-22, -8, 3, 33);
      
      // Hood at back of head
      ctx.fillStyle = HOODIE_SHADE;
      ctx.beginPath();
      ctx.arc(0, -10, 17, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = HOODIE;
      ctx.beginPath();
      ctx.arc(0, -8, 15, Math.PI, 0);
      ctx.fill();
      
      // Hoodie pocket (front)
      ctx.fillStyle = HOODIE_SHADE;
      ctx.fillRect(-15, 5, 30, 12);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-15, 5, 30, 12);
      
      // SS Logo on chest
      ctx.fillStyle = "#f97316";
      ctx.font = "bold italic 11px 'DM Sans'";
      ctx.textAlign = "center";
      ctx.fillText("SS", 0, 2);
      
      // Chain necklace 
      ctx.fillStyle = "#d4af37";
      ctx.beginPath();
      ctx.arc(0, -3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.quadraticCurveTo(0, -2, 6, -6);
      ctx.stroke();
      
      ctx.restore();
      
      // ── ARMS ──
      ctx.save();
      ctx.translate(px + lean, py + bodyBob);
      ctx.fillStyle = HOODIE;
      if (isShoot) {
        // Both arms raised for shoot
        ctx.fillRect(-26, -6 - armRaise, 9, 28);
        ctx.fillRect(17, -6 - armRaise, 9, 28);
        // Hand shading
        ctx.fillStyle = HOODIE_SHADE;
        ctx.fillRect(-26, -6 - armRaise, 2, 28);
        // Hands
        ctx.fillStyle = SKIN;
        ctx.beginPath();
        ctx.arc(-22, -8 - armRaise, 5, 0, Math.PI * 2);
        ctx.arc(22, -8 - armRaise, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Normal arms with walk swing
        ctx.fillRect(-26, -6 + armSwing, 9, 28);
        ctx.fillRect(17, -6 - armSwing, 9, 28);
        ctx.fillStyle = HOODIE_SHADE;
        ctx.fillRect(-26, -6 + armSwing, 2, 28);
        // Hands
        ctx.fillStyle = SKIN;
        ctx.beginPath();
        ctx.arc(-22, 21 + armSwing, 4, 0, Math.PI * 2);
        ctx.arc(22, 21 - armSwing, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      
      // ── HEAD ──
      ctx.save();
      ctx.translate(px + lean, py + bodyBob);
      
      // Head (face)
      ctx.fillStyle = SKIN;
      ctx.beginPath();
      ctx.arc(0, -18, 11, 0, Math.PI * 2);
      ctx.fill();
      // Face shading on opposite side of facing
      ctx.fillStyle = SKIN_SHADE;
      ctx.beginPath();
      ctx.arc(facing * 3, -18, 11, -Math.PI/2 + facing*0.3, Math.PI/2 + facing*0.3);
      ctx.fill();
      
      // Cap (backwards) - more 3D
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(0, -22, 12, Math.PI, 0);
      ctx.fill();
      // Cap front
      ctx.fillRect(-12, -22, 24, 6);
      // Cap highlight
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(-12, -22, 24, 1);
      
      // Cap brim (back side)
      ctx.fillStyle = "#000";
      ctx.fillRect(-16 + facing * -2, -19, 6, 4);
      
      // Cap logo (small SS)
      ctx.fillStyle = "#f97316";
      ctx.font = "bold 7px 'DM Sans'";
      ctx.fillText("SS", 0, -25);
      
      // Eyes
      ctx.fillStyle = "#000";
      ctx.fillRect(-4 + facing, -19, 2, 2);
      ctx.fillRect(2 + facing, -19, 2, 2);
      
      // Subtle beard/jaw shading
      ctx.fillStyle = SKIN_SHADE;
      ctx.fillRect(-4, -12, 8, 1);
      
      // Earrings
      ctx.fillStyle = "#d4af37";
      ctx.fillRect(-10 + facing * -1, -15, 1, 2);
      ctx.fillRect(9 + facing * -1, -15, 1, 2);
      
      ctx.restore();

      // Catch zone indicator (matches shoot logic: 40px wide, 80px tall around y=480)
      ctx.fillStyle = "rgba(249, 115, 22, 0.08)";
      ctx.fillRect(px - 40, 400, 80, 160);
      
      // AIM LINE - if there's a ball in catch zone, show trajectory
      if (!game.current.shotBall) {
        let canCatch = false;
        for (let i = 0; i < game.current.fallingBalls.length; i++) {
          const b = game.current.fallingBalls[i];
          const dx = Math.abs(b.x - px);
          const dy = Math.abs(b.y - 480);
          if (dx < 40 && dy < 80) {
            canCatch = true;
            break;
          }
        }
        if (canCatch) {
          // Draw dotted aim line toward hoop
          const hxA = game.current.hoop.x;
          const hyA = game.current.hoop.y;
          ctx.strokeStyle = "rgba(249, 115, 22, 0.5)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          // Animated dash offset
          ctx.lineDashOffset = -(F * 0.3);
          ctx.beginPath();
          // Curved path (parabolic approximation)
          const startX = px;
          const startY = 460;
          const cpX = (startX + hxA) / 2;
          const cpY = Math.min(startY, hyA) - 60;
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(cpX, cpY, hxA, hyA);
          ctx.stroke();
          ctx.setLineDash([]); // Reset
          // Pulsing target circle on hoop
          const pulse = Math.sin(F * 0.2) * 0.3 + 0.7;
          ctx.strokeStyle = `rgba(249, 115, 22, ${pulse * 0.7})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hxA, hyA, 30 + Math.sin(F * 0.15) * 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Shot ball
      if (game.current.shotBall) {
        const sb = game.current.shotBall;
        // Store trail history
        if (!sb.trail) sb.trail = [];
        sb.trail.push({ x: sb.x, y: sb.y });
        if (sb.trail.length > 8) sb.trail.shift();
        
        sb.x += sb.vx;
        sb.y += sb.vy;
        sb.vy += 0.3;
        
        // Bounce shot ball off walls so it stays in play
        if (sb.x < 12 && sb.vx < 0) {
          sb.x = 12;
          sb.vx = -sb.vx * 0.85;
          playSound("bounce_soft");
        }
        if (sb.x > W - 12 && sb.vx > 0) {
          sb.x = W - 12;
          sb.vx = -sb.vx * 0.85;
          playSound("bounce_soft");
        }
        
        // Draw motion trail (shadow positions)
        for (let t = 0; t < sb.trail.length; t++) {
          const tp = sb.trail[t];
          const alpha = (t / sb.trail.length) * 0.35;
          ctx.fillStyle = `rgba(249, 115, 22, ${alpha})`;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 9 - (sb.trail.length - t) * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Ground shadow for shot ball
        const sbGroundY = 555;
        const sbHeight = sbGroundY - sb.y;
        const sbShadowSize = Math.max(3, 10 - sbHeight / 80);
        const sbShadowAlpha = Math.max(0.05, 0.35 - sbHeight / 1500);
        ctx.fillStyle = `rgba(0, 0, 0, ${sbShadowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(sb.x, sbGroundY, sbShadowSize, sbShadowSize * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw shot ball - realistic
        ctx.save();
        ctx.translate(sb.x, sb.y);
        // Rotation based on movement
        const shotRot = (F * 0.15) % (Math.PI * 2);
        ctx.rotate(shotRot);
        const sbGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 10);
        sbGrad.addColorStop(0, "#e76d1f");
        sbGrad.addColorStop(0.7, "#cc5500");
        sbGrad.addColorStop(1, "#8a3800");
        ctx.fillStyle = sbGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#1a0a00";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, 10, -Math.PI/2 - 0.3, Math.PI/2 + 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 10, Math.PI/2 - 0.3, Math.PI*1.5 + 0.3);
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 200, 150, 0.4)";
        ctx.beginPath();
        ctx.arc(-3, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const dx2 = sb.x - hx;
        const dy2 = sb.y - hy;
        // SWISH - perfect through center
        if (Math.abs(dx2) < 14 && Math.abs(dy2) < 8 && sb.vy > 0) {
          playSound("swish");
          setScore(s => s + 3);
          // SWISH particles - golden burst
          for (let p = 0; p < 25; p++) {
            const angle = (p / 25) * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            game.current.particles.push({
              x: sb.x,
              y: sb.y + 10,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 1,
              life: 30 + Math.random() * 15,
              maxLife: 45,
              size: 2 + Math.random() * 2,
              r: 255,
              g: 200 + Math.random() * 55,
              b: 50 + Math.random() * 60,
            });
          }
          game.current.shakeAmount = 8; // Screen shake!
          setCombo(c => {
            const nc = c + 1;
            game.current.currentCombo = nc;
            setBestCombo(bc => Math.max(bc, nc));
            if (nc >= 5) {
              setFeedback({ text: `🔥 ON FIRE! x${nc}`, color: "#facc15" });
              game.current.shakeAmount = 14; // Bigger shake
            } else if (nc >= 3) {
              setFeedback({ text: `SWISH x${nc} +3`, color: "#facc15" });
            } else {
              setFeedback({ text: "SWISH! +3", color: "#4ade80" });
            }
            setTimeout(()=>setFeedback(null), 600);
            return nc;
          });
          game.current.shotBall = null;
        }
        // RIM SHOT - hits the edge and goes in (1p)
        else if (Math.abs(dx2) < 22 && Math.abs(dx2) >= 14 && Math.abs(dy2) < 8 && sb.vy > 0) {
          playSound("swish");
          setScore(s => s + 1);
          // Smaller particle burst for rim
          for (let p = 0; p < 12; p++) {
            const angle = (p / 12) * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            game.current.particles.push({
              x: sb.x,
              y: sb.y + 5,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.5,
              life: 20 + Math.random() * 10,
              maxLife: 30,
              size: 1.5 + Math.random() * 1.5,
              r: 249,
              g: 115,
              b: 22,
            });
          }
          game.current.shakeAmount = 4;
          setCombo(c => {
            const nc = c + 1;
            game.current.currentCombo = nc;
            setBestCombo(bc => Math.max(bc, nc));
            setFeedback({ text: "RIM! +1", color: "#f97316" });
            setTimeout(()=>setFeedback(null), 600);
            return nc;
          });
          game.current.shotBall = null;
        }
        // MISS - convert to bouncing ball so player can catch it again!
        else if (sb.y > 540) {
          // Cap ALL velocities hard before converting to falling ball
          // This way subsequent bounces won't be explosive
          const cappedVx = Math.max(-1.5, Math.min(1.5, sb.vx));
          // Set a low vy directly so first bounce is gentle
          game.current.fallingBalls.push({
            x: sb.x,
            y: 540,
            vx: cappedVx,
            vy: -1.8, // Fixed gentle bounce
            rot: 0,
            rotSpeed: (Math.random() - 0.5) * 0.15,
          });
          setCombo(0);
          game.current.currentCombo = 0;
          game.current.shotBall = null;
        }
      }

      // Move player
      if (game.current.keys.left && game.current.player.x > 30) {
        game.current.player.x -= 4.5;
      }
      if (game.current.keys.right && game.current.player.x < W - 30) {
        game.current.player.x += 4.5;
      }

      // Move hoop horizontally
      game.current.hoop.x += game.current.hoop.dir * game.current.hoop.speed;
      if (game.current.hoop.x > W - 50 || game.current.hoop.x < 50) {
        game.current.hoop.dir *= -1;
      }
      // Move hoop vertically
      game.current.hoop.y += game.current.hoop.ydir * game.current.hoop.yspeed;
      if (game.current.hoop.y > 180 || game.current.hoop.y < 70) {
        game.current.hoop.ydir *= -1;
      }
      
      // ── PARTICLES (drawn last, on top of everything) ──
      
      // Swish particles (golden glitter)
      for (let i = game.current.particles.length - 1; i >= 0; i--) {
        const p = game.current.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life--;
        p.size *= 0.96;
        if (p.life <= 0 || p.size < 0.5) {
          game.current.particles.splice(i, 1);
          continue;
        }
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        // Glow
        ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Dust particles (under feet)
      for (let i = game.current.dustParticles.length - 1; i >= 0; i--) {
        const d = game.current.dustParticles[i];
        d.x += d.vx;
        d.y += d.vy;
        d.vy -= 0.05;
        d.life--;
        d.size *= 0.97;
        if (d.life <= 0) {
          game.current.dustParticles.splice(i, 1);
          continue;
        }
        const alpha = (d.life / d.maxLife) * 0.5;
        ctx.fillStyle = `rgba(180, 160, 140, ${alpha})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Fire particles (around player when combo 5+)
      const playerCombo = game.current.currentCombo || 0;
      if (playerCombo >= 5 && F % 3 === 0) {
        for (let k = 0; k < 2; k++) {
          game.current.fireParticles.push({
            x: game.current.player.x + (Math.random() - 0.5) * 30,
            y: game.current.player.y + 20 + Math.random() * 25,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1.5 - Math.random() * 1.5,
            life: 25 + Math.random() * 10,
            maxLife: 35,
            size: 4 + Math.random() * 3,
          });
        }
      }
      for (let i = game.current.fireParticles.length - 1; i >= 0; i--) {
        const f = game.current.fireParticles[i];
        f.x += f.vx;
        f.y += f.vy;
        f.life--;
        f.size *= 0.95;
        if (f.life <= 0) {
          game.current.fireParticles.splice(i, 1);
          continue;
        }
        const t = f.life / f.maxLife;
        // Fire colors: yellow -> orange -> red -> dark
        let r, g, b;
        if (t > 0.7) { r = 255; g = 240; b = 100; }
        else if (t > 0.4) { r = 255; g = 150; b = 30; }
        else { r = 200; g = 50; b = 20; }
        const alpha = t * 0.8;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();
        // Inner glow
        ctx.fillStyle = `rgba(255, 240, 200, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Spawn dust when player moves
      if ((game.current.keys.left || game.current.keys.right) && F % 4 === 0) {
        const side = game.current.keys.left ? 1 : -1;
        game.current.dustParticles.push({
          x: game.current.player.x + side * 10,
          y: game.current.player.y + 50,
          vx: side * (0.5 + Math.random() * 0.8),
          vy: -0.2 - Math.random() * 0.4,
          life: 15 + Math.random() * 10,
          maxLife: 25,
          size: 2 + Math.random() * 2,
        });
      }
      
      // Restore from screen shake
      ctx.restore();

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return ()=>cancelAnimationFrame(animationId);
  },[started]);

  return (
    <div style={S.root}>
      <style>{`
        body { margin: 0; background: #000; overflow: hidden; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; }
        button { transition: transform .1s; }
        button:active { transform: scale(0.92); }
        @keyframes pop { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; } 50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 0; } }
      `}</style>

      <div style={S.container}>
        <div style={S.header}>
          <div style={S.logoStreet}>STREET</div>
          <div style={S.logoShot}>SHOT</div>
        </div>

        {!started && !gameOver && (
          <div style={S.menu}>
            <div style={S.hsBox}>
              <div style={S.hsLabel}>HIGHSCORE</div>
              <div style={S.hsValue}>{highscore}</div>
            </div>
            <button onClick={startGame} style={S.playBtn}>▶ TAP TO PLAY</button>
            <div style={S.tagline}>90 sek! +15s per 5 poäng. SWISH = 3p, RIM = 1p.</div>
          </div>
        )}

        {gameOver && (
          <div style={S.menu}>
            <div style={S.gameOverTitle}>GAME OVER</div>
            <div style={S.statsBox}>
              <div style={S.statRow}><span style={S.statLabel}>SCORE</span><span style={S.statValue}>{score}</span></div>
              <div style={S.statRow}><span style={S.statLabel}>BEST COMBO</span><span style={S.statValue}>x{bestCombo}</span></div>
              <div style={S.statRow}><span style={S.statLabel}>HIGHSCORE</span><span style={{...S.statValue, color: score>=highscore && score>0 ?"#4ade80":"#fff"}}>{highscore}</span></div>
              {score >= highscore && score > 0 && <div style={S.newHs}>🏆 NEW HIGHSCORE!</div>}
            </div>
            <button onClick={startGame} style={S.playBtn}>↺ AGAIN</button>
          </div>
        )}

        {started && (
          <>
            <div style={S.hud}>
              <div><div style={S.hudLabel}>SCORE</div><div style={S.hudScore}>{score}</div></div>
              <div style={{textAlign:"center"}}>
                <div style={S.hudLabel}>TIME</div>
                <div style={{...S.hudCombo, color: timeLeft <= 10 ? "#ef4444" : "#fff"}}>{timeLeft}s</div>
              </div>
              <div style={{textAlign:"right"}}><div style={S.hudLabel}>COMBO</div><div style={{...S.hudCombo, color: combo >= 3 ? "#facc15" : "#fff"}}>x{combo}</div></div>
            </div>

            <canvas ref={canvasRef} width={W} height={H} onClick={shoot} style={S.canvas}/>

            {feedback && <div style={{...S.feedback, color: feedback.color}}>{feedback.text}</div>}

            <div style={S.mobileControls}>
              <button
                onTouchStart={(e)=>{ e.preventDefault(); game.current.keys.left=true; }}
                onTouchEnd={(e)=>{ e.preventDefault(); game.current.keys.left=false; }}
                onMouseDown={()=>game.current.keys.left=true}
                onMouseUp={()=>game.current.keys.left=false}
                onMouseLeave={()=>game.current.keys.left=false}
                style={S.moveBtn}>◀</button>
              <button onClick={shoot} onTouchStart={(e)=>{ e.preventDefault(); shoot(); }} style={S.shootBtn}>🏀</button>
              <button
                onTouchStart={(e)=>{ e.preventDefault(); game.current.keys.right=true; }}
                onTouchEnd={(e)=>{ e.preventDefault(); game.current.keys.right=false; }}
                onMouseDown={()=>game.current.keys.right=true}
                onMouseUp={()=>game.current.keys.right=false}
                onMouseLeave={()=>game.current.keys.right=false}
                style={S.moveBtn}>▶</button>
            </div>
            <div style={S.hint}>Stå under bollen → SHOOT</div>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", maxHeight: "100vh", overflow: "hidden", background: "linear-gradient(180deg, #0a0a0a 0%, #1a1018 100%)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6px 8px", fontFamily: "'DM Sans', sans-serif", color: "#fff" },
  container: { width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100vh" },
  header: { textAlign: "center", marginBottom: 2, lineHeight: 0.85 },
  logoStreet: { fontFamily: "'Bebas Neue', cursive", fontSize: 26, color: "#fff", letterSpacing: 3, textShadow: "2px 2px 0 #000" },
  logoShot: { fontFamily: "'Bebas Neue', cursive", fontSize: 36, color: "#f97316", letterSpacing: 5, textShadow: "2px 2px 0 #000", marginTop: -4 },
  menu: { width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 10px" },
  hsBox: { background: "#111", border: "1px solid #333", borderRadius: 4, padding: "12px 24px", textAlign: "center", minWidth: 200 },
  hsLabel: { fontSize: 10, color: "#666", letterSpacing: 3, fontWeight: 700, marginBottom: 4 },
  hsValue: { fontFamily: "'Bebas Neue', cursive", fontSize: 48, color: "#f97316", letterSpacing: 2, lineHeight: 1 },
  playBtn: { background: "#f97316", color: "#000", border: "none", padding: "18px 50px", fontFamily: "'Bebas Neue', cursive", fontSize: 30, letterSpacing: 4, cursor: "pointer", borderRadius: 4, boxShadow: "0 4px 0 #c25510", fontWeight: 900 },
  tagline: { fontSize: 13, color: "#888", letterSpacing: 1, marginTop: 4, fontWeight: 600, textAlign: "center", padding: "0 20px" },
  gameOverTitle: { fontFamily: "'Bebas Neue', cursive", fontSize: 44, color: "#ef4444", letterSpacing: 3 },
  statsBox: { background: "#111", border: "1px solid #333", padding: "14px 20px", minWidth: 230 },
  statRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #222", alignItems: "center" },
  statLabel: { fontSize: 11, color: "#888", letterSpacing: 2, fontWeight: 700 },
  statValue: { fontFamily: "'Bebas Neue', cursive", fontSize: 24, color: "#fff" },
  newHs: { textAlign: "center", marginTop: 10, fontFamily: "'Bebas Neue', cursive", fontSize: 18, color: "#4ade80", letterSpacing: 2 },
  hud: { width: "100%", display: "flex", justifyContent: "space-between", padding: "0 8px", alignItems: "center", marginBottom: 2 },
  hudLabel: { fontSize: 8, color: "#666", letterSpacing: 2, fontWeight: 700 },
  hudScore: { fontFamily: "'Bebas Neue', cursive", fontSize: 22, color: "#f97316", lineHeight: 1 },
  hudTime: { fontFamily: "'Bebas Neue', cursive", fontSize: 22, lineHeight: 1 },
  hudCombo: { fontFamily: "'Bebas Neue', cursive", fontSize: 20, lineHeight: 1 },
  misses: { display: "flex", gap: 2, justifyContent: "center", marginTop: 3 },
  canvas: { width: "100%", maxWidth: 400, flex: 1, minHeight: 0, maxHeight: "60vh", aspectRatio: "400/600", background: "#000", border: "2px solid #222", borderRadius: 4, touchAction: "none", cursor: "pointer", objectFit: "contain" },
  feedback: { position: "fixed", top: "45%", left: "50%", fontFamily: "'Bebas Neue', cursive", fontSize: 40, letterSpacing: 3, textShadow: "3px 3px 0 #000", pointerEvents: "none", animation: "pop 0.6s ease-out", zIndex: 10 },
  mobileControls: { width: "100%", display: "flex", gap: 10, marginTop: 12, padding: "0 4px" },
  moveBtn: { flex: 1, background: "#1a1a1a", border: "2px solid #444", color: "#fff", padding: "32px 0", fontSize: 36, fontWeight: 900, borderRadius: 8, cursor: "pointer" },
  shootBtn: { flex: 1.5, background: "#f97316", border: "none", color: "#000", padding: "32px 0", fontFamily: "'Bebas Neue', cursive", fontSize: 36, fontWeight: 900, letterSpacing: 2, borderRadius: 8, cursor: "pointer", boxShadow: "0 4px 0 #c25510" },
  hint: { fontSize: 10, color: "#555", letterSpacing: 1, marginTop: 0 },
};
