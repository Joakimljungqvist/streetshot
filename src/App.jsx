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

      // ── UNDERGROUND TUNNEL BACKGROUND ──
      // Deep tunnel gradient (dark to lit)
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#0a0a12");
      grad.addColorStop(0.3, "#15151f");
      grad.addColorStop(0.6, "#1a1a25");
      grad.addColorStop(0.85, "#252028");
      grad.addColorStop(1, "#1a1418");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      
      // Tunnel ceiling arch (dark vignette at top)
      const arch = ctx.createRadialGradient(W/2, -50, 50, W/2, -50, 350);
      arch.addColorStop(0, "rgba(0,0,0,0)");
      arch.addColorStop(1, "rgba(0,0,0,0.6)");
      ctx.fillStyle = arch;
      ctx.fillRect(0, 0, W, 200);
      
      // Brick wall texture (left and right walls)
      ctx.fillStyle = "#2a1f1a";
      // Left wall bricks
      for (let row = 0; row < 12; row++) {
        for (let col = 0; col < 2; col++) {
          const offset = (row % 2) * 15;
          const bx = col * 30 + offset - 5;
          const by = row * 40 + 20;
          ctx.fillRect(bx, by, 28, 38);
          // Brick highlight
          ctx.fillStyle = "rgba(80, 50, 40, 0.5)";
          ctx.fillRect(bx, by, 28, 2);
          ctx.fillStyle = "#2a1f1a";
        }
      }
      // Right wall bricks
      for (let row = 0; row < 12; row++) {
        for (let col = 0; col < 2; col++) {
          const offset = (row % 2) * 15;
          const bx = W - 65 + col * 30 + offset;
          const by = row * 40 + 20;
          ctx.fillRect(bx, by, 28, 38);
          ctx.fillStyle = "rgba(80, 50, 40, 0.5)";
          ctx.fillRect(bx, by, 28, 2);
          ctx.fillStyle = "#2a1f1a";
        }
      }
      
      // Graffiti on left wall (subtle)
      ctx.fillStyle = "#d97706";
      ctx.font = "bold italic 14px sans-serif";
      ctx.textAlign = "left";
      ctx.save();
      ctx.translate(8, 180);
      ctx.rotate(-0.1);
      ctx.globalAlpha = 0.5;
      ctx.fillText("SS", 0, 0);
      ctx.restore();
      
      ctx.fillStyle = "#5a3030";
      ctx.font = "bold italic 12px sans-serif";
      ctx.save();
      ctx.translate(15, 280);
      ctx.rotate(0.05);
      ctx.globalAlpha = 0.4;
      ctx.fillText("STREET", 0, 0);
      ctx.restore();
      
      // Graffiti on right wall
      ctx.fillStyle = "#7c2d12";
      ctx.font = "bold italic 16px sans-serif";
      ctx.save();
      ctx.translate(W - 60, 200);
      ctx.rotate(0.08);
      ctx.globalAlpha = 0.5;
      ctx.fillText("KING", 0, 0);
      ctx.restore();
      
      ctx.globalAlpha = 1;
      
      // Hanging tunnel lights (3 of them)
      for (let i = 0; i < 3; i++) {
        const lx = 80 + i * 120;
        const ly = 30;
        // Light cone (soft glow)
        const lightGrad = ctx.createRadialGradient(lx, ly + 5, 5, lx, ly + 60, 80);
        lightGrad.addColorStop(0, "rgba(255, 220, 150, 0.4)");
        lightGrad.addColorStop(0.5, "rgba(255, 180, 100, 0.15)");
        lightGrad.addColorStop(1, "rgba(255, 180, 100, 0)");
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx - 60, ly + 120);
        ctx.lineTo(lx + 60, ly + 120);
        ctx.closePath();
        ctx.fill();
        // Light bulb
        ctx.fillStyle = "#fef3c7";
        ctx.beginPath();
        ctx.arc(lx, ly + 5, 4, 0, Math.PI * 2);
        ctx.fill();
        // Wire
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, ly);
        ctx.stroke();
      }
      
      // Chain link fence (subtle in middle distance)
      ctx.strokeStyle = "rgba(100, 100, 100, 0.15)";
      ctx.lineWidth = 1;
      for (let x = 70; x < W - 70; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, 250);
        ctx.lineTo(x + 8, 258);
        ctx.lineTo(x, 266);
        ctx.lineTo(x - 8, 258);
        ctx.closePath();
        ctx.stroke();
      }
      
      // Court floor - asphalt with reflections
      const floorGrad = ctx.createLinearGradient(0, 460, 0, H);
      floorGrad.addColorStop(0, "#2a1f1a");
      floorGrad.addColorStop(0.5, "#1a1410");
      floorGrad.addColorStop(1, "#0a0805");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, 460, W, H - 460);
      
      // Wet floor reflections
      ctx.fillStyle = "rgba(255, 220, 150, 0.04)";
      for (let i = 0; i < 8; i++) {
        const wx = (i * 53) % W;
        ctx.fillRect(wx, 480 + (i*7)%80, 30 + (i*3)%20, 2);
      }
      
      // Court line (free throw)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 470);
      ctx.lineTo(W, 470);
      ctx.stroke();
      // Free throw arc
      ctx.beginPath();
      ctx.arc(W/2, 470, 75, Math.PI, 0);
      ctx.stroke();
      
      // Water puddles on floor
      ctx.fillStyle = "rgba(70, 100, 130, 0.2)";
      ctx.beginPath();
      ctx.ellipse(80, 540, 35, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(320, 555, 28, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Puddle highlights
      ctx.fillStyle = "rgba(180, 200, 220, 0.15)";
      ctx.beginPath();
      ctx.ellipse(80, 538, 25, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hoop
      const hx = game.current.hoop.x;
      const hy = game.current.hoop.y;
      ctx.fillStyle = "#fff";
      ctx.fillRect(hx - 40, hy - 35, 80, 5);
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.strokeRect(hx - 15, hy - 30, 30, 20);
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(hx, hy, 25, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      for (let i = -25; i <= 25; i += 6) {
        ctx.beginPath();
        ctx.moveTo(hx + i, hy);
        ctx.lineTo(hx + i * 0.6, hy + 22);
        ctx.stroke();
      }

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
        
        // Bounce off ground - realistic energy loss
        if (b.y > 540) {
          b.y = 540;
          b.vy = -Math.abs(b.vy) * 0.4;
          b.vx *= 0.85;
          if (Math.abs(b.vy) < 1.2) {
            // Ball lost energy, count as miss and remove
            game.current.fallingBalls.splice(i, 1);
            playSound("drop");
            setMisses(m => m + 1);
            setCombo(0);
            continue;
          }
        }
        
        // Bounce off ceiling
        if (b.y < 15) {
          b.y = 15;
          b.vy = Math.abs(b.vy) * 0.85;
        }
        
        // Draw ball
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = "#cc5500";
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.restore();
      }

      // Player - animated!
      const px = game.current.player.x;
      const py = game.current.player.y;
      const facing = game.current.player.facing; // -1 left, 0 idle, 1 right
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
      const breath = Math.sin(F * 0.05) * 1.2; // subtle idle breathing
      const legSwing = isMoving ? Math.sin(walk) * 6 : 0;
      const armSwing = isMoving ? Math.sin(walk) * 4 : 0;
      const bodyBob = isMoving ? Math.abs(Math.sin(walk * 2)) * 2 : breath;
      const lean = facing * (isMoving ? 2 : 0);
      
      // Shoot animation - arms go up
      const shootProgress = isShoot ? (20 - shootAnim) / 20 : 0;
      const armRaise = Math.sin(shootProgress * Math.PI) * 35;
      
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(px, py + 50, 22, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Legs (with walk cycle)
      ctx.fillStyle = "#1a1a1a";
      ctx.save();
      ctx.translate(px + lean, py + bodyBob);
      // Left leg
      ctx.fillRect(-14, 20 - legSwing, 12, 28 + legSwing);
      // Right leg
      ctx.fillRect(2, 20 + legSwing, 12, 28 - legSwing);
      // Sneakers (white with stripes)
      ctx.fillStyle = "#fff";
      ctx.fillRect(-16, 46 - legSwing, 14, 5);
      ctx.fillRect(2, 46 + legSwing, 14, 5);
      // Sneaker stripes
      ctx.fillStyle = "#f97316";
      ctx.fillRect(-15, 48 - legSwing, 12, 1);
      ctx.fillRect(3, 48 + legSwing, 12, 1);
      ctx.restore();
      
      // Body (hoodie)
      ctx.save();
      ctx.translate(px + lean, py + bodyBob);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(-20, -10, 40, 35);
      // Hoodie hood (back of head shape)
      ctx.fillStyle = "#2a2a2a";
      ctx.beginPath();
      ctx.arc(0, -10, 15, Math.PI, 0);
      ctx.fill();
      // SS logo
      ctx.fillStyle = "#f97316";
      ctx.font = "bold 10px 'DM Sans'";
      ctx.textAlign = "center";
      ctx.fillText("SS", 0, 10);
      ctx.restore();
      
      // Arms
      ctx.save();
      ctx.translate(px + lean, py + bodyBob);
      ctx.fillStyle = "#1a1a1a";
      if (isShoot) {
        // Both arms raised for shoot
        ctx.fillRect(-25, -8 - armRaise, 8, 28);
        ctx.fillRect(17, -8 - armRaise, 8, 28);
        // Hands at top
        ctx.fillStyle = "#c8956a";
        ctx.beginPath();
        ctx.arc(-21, -10 - armRaise, 5, 0, Math.PI * 2);
        ctx.arc(21, -10 - armRaise, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Normal arms with walk swing
        ctx.fillRect(-25, -8 + armSwing, 8, 28);
        ctx.fillRect(17, -8 - armSwing, 8, 28);
        // Hands
        ctx.fillStyle = "#c8956a";
        ctx.beginPath();
        ctx.arc(-21, 20 + armSwing, 4, 0, Math.PI * 2);
        ctx.arc(21, 20 - armSwing, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      
      // Head
      ctx.save();
      ctx.translate(px + lean, py + bodyBob);
      ctx.fillStyle = "#c8956a";
      ctx.beginPath();
      ctx.arc(0, -18, 11, 0, Math.PI * 2);
      ctx.fill();
      // Eyes (small dots)
      ctx.fillStyle = "#000";
      ctx.fillRect(-4 + facing, -20, 2, 2);
      ctx.fillRect(2 + facing, -20, 2, 2);
      // Cap (backwards)
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(0, -22, 11, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-11, -22, 22, 5);
      // Cap brim (back side - opposite to facing)
      ctx.fillRect(-14 - facing * 2, -18, 4, 3);
      // Subtle cap detail
      ctx.fillStyle = "#f97316";
      ctx.fillRect(-2, -27, 4, 2);
      ctx.restore();

      // Catch zone indicator (matches shoot logic: 40px wide, 80px tall around y=480)
      ctx.fillStyle = "rgba(249, 115, 22, 0.08)";
      ctx.fillRect(px - 40, 400, 80, 160);

      // Shot ball
      if (game.current.shotBall) {
        const sb = game.current.shotBall;
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
        
        ctx.fillStyle = "#cc5500";
        ctx.beginPath();
        ctx.arc(sb.x, sb.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sb.x - 10, sb.y);
        ctx.lineTo(sb.x + 10, sb.y);
        ctx.moveTo(sb.x, sb.y - 10);
        ctx.lineTo(sb.x, sb.y + 10);
        ctx.stroke();
        const dx2 = sb.x - hx;
        const dy2 = sb.y - hy;
        // SWISH - perfect through center
        if (Math.abs(dx2) < 14 && Math.abs(dy2) < 8 && sb.vy > 0) {
          playSound("swish");
          setScore(s => s + 3);
          setCombo(c => {
            const nc = c + 1;
            setBestCombo(bc => Math.max(bc, nc));
            if (nc >= 3) {
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
          setCombo(c => {
            const nc = c + 1;
            setBestCombo(bc => Math.max(bc, nc));
            setFeedback({ text: "RIM! +1", color: "#f97316" });
            setTimeout(()=>setFeedback(null), 600);
            return nc;
          });
          game.current.shotBall = null;
        }
        // MISS - convert to bouncing ball so player can catch it again!
        else if (sb.y > 540) {
          // Ball hit the ground - convert to bouncing ball with realistic bounce
          game.current.fallingBalls.push({
            x: sb.x,
            y: 540,
            vx: sb.vx * 0.8,
            vy: -Math.abs(sb.vy) * 0.5,
            rot: 0,
            rotSpeed: (Math.random() - 0.5) * 0.15,
          });
          setCombo(0);
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
