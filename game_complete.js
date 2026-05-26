// ============================================================
// NightLock: Last Light — Complete Game Engine
// Pure procedural graphics, no PNG/MP3 dependencies required
// Author: Manan Pahuja | pahujamanan2011@gmail.com
// ============================================================

'use strict';

// ── DOM & Canvas Setup ───────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('startBtn');
const quitBtn = document.getElementById('quitBtn');
const scoreText = document.getElementById('score');
const ammoText = document.getElementById('ammoText');
const weaponIcon = document.getElementById('weaponIcon');
const livesUI = document.getElementById('livesUI');

// Responsive canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── World Constants ──────────────────────────────────────────
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

// ── Game State ───────────────────────────────────────────────
let gameRunning = false;
let keys = {};
let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let frameCount = 0;
let difficulty = 1;
let gameOverTime = 0;

// ── Camera ───────────────────────────────────────────────────
const camera = {
    x: 0,
    y: 0,
    smoothness: 0.08,
    shake: { x: 0, y: 0, mag: 0, dur: 0 }
};

// ── Player ───────────────────────────────────────────────────
const player = {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    speed: 5,
    radius: 20,
    angle: 0,
    ammo: { pistol: 60, shotgun: 20 },
    weapon: 'pistol',
    lives: 3,
    maxLives: 3,
    score: 0,
    highScore: 0,
    fireCooldown: 0,
    invTimer: 0,
    hitFlash: 0,
    walkCycle: 0,
    activeEffects: {}
};

// ── Game Objects ─────────────────────────────────────────────
let zombies = [];
let barrels = [];
let bullets = [];
let particles = [];
let bloodPools = [];
let powerups = [];
let boss = null;

// ── Spawning & Difficulty ────────────────────────────────────
let spawnTimer = 0;
let spawnInterval = 120;
let bossSpawned = false;
let bossCount = 0;
let ambientTimer = 0;
let heartbeatTimer = 0;

// ── Audio Context ────────────────────────────────────────────
let audioCtx = null;
let bgOscNodes = [];
let bgPlaying = false;

function getAC() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playSound(type, vol = 0.3) {
    try {
        const ac = getAC();
        if (type === 'pistol') {
            // Pistol crack
            const o = ac.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(600, ac.currentTime);
            o.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.08);
            const g = ac.createGain();
            g.gain.setValueAtTime(0.4, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
            o.connect(g);
            g.connect(ac.destination);
            o.start();
            o.stop(ac.currentTime + 0.09);
        } else if (type === 'shotgun') {
            // Shotgun boom
            const buf = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
            }
            const src = ac.createBufferSource();
            src.buffer = buf;
            const flt = ac.createBiquadFilter();
            flt.type = 'lowpass';
            flt.frequency.value = 1000;
            const g = ac.createGain();
            g.gain.value = 0.8;
            src.connect(flt);
            flt.connect(g);
            g.connect(ac.destination);
            src.start();
        } else if (type === 'zombie_die') {
            // Zombie death groan
            const o = ac.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(200, ac.currentTime);
            o.frequency.linearRampToValueAtTime(40, ac.currentTime + 0.4);
            const g = ac.createGain();
            g.gain.setValueAtTime(0.35, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
            o.connect(g);
            g.connect(ac.destination);
            o.start();
            o.stop(ac.currentTime + 0.41);
        } else if (type === 'player_hit') {
            // Damage thud
            const o = ac.createOscillator();
            o.type = 'sine';
            o.frequency.value = 120;
            const g = ac.createGain();
            g.gain.setValueAtTime(0.4, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
            o.connect(g);
            g.connect(ac.destination);
            o.start();
            o.stop(ac.currentTime + 0.21);
        } else if (type === 'powerup') {
            // Ascending chime
            [330, 440, 550].forEach((freq, i) => {
                const o = ac.createOscillator();
                o.type = 'square';
                o.frequency.value = freq;
                const g = ac.createGain();
                g.gain.setValueAtTime(0.15, ac.currentTime + i * 0.08);
                g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.08 + 0.12);
                o.connect(g);
                g.connect(ac.destination);
                o.start(ac.currentTime + i * 0.08);
                o.stop(ac.currentTime + i * 0.08 + 0.13);
            });
        } else if (type === 'empty') {
            // Empty gun click
            const o = ac.createOscillator();
            o.type = 'square';
            o.frequency.value = 200;
            const g = ac.createGain();
            g.gain.setValueAtTime(0.15, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
            o.connect(g);
            g.connect(ac.destination);
            o.start();
            o.stop(ac.currentTime + 0.06);
        } else if (type === 'boss_spawn') {
            // Boss arrival roar
            for (let i = 0; i < 5; i++) {
                const o = ac.createOscillator();
                o.type = 'sawtooth';
                o.frequency.value = 60 + i * 25;
                const g = ac.createGain();
                g.gain.setValueAtTime(0.25, ac.currentTime + i * 0.1);
                g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.1 + 0.35);
                o.connect(g);
                g.connect(ac.destination);
                o.start(ac.currentTime + i * 0.1);
                o.stop(ac.currentTime + i * 0.1 + 0.36);
            }
        } else if (type === 'boss_die') {
            // Boss death
            for (let i = 0; i < 8; i++) {
                const o = ac.createOscillator();
                o.type = 'sine';
                o.frequency.value = 300 - i * 30;
                const g = ac.createGain();
                g.gain.setValueAtTime(0.2, ac.currentTime + i * 0.06);
                g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.06 + 0.3);
                o.connect(g);
                g.connect(ac.destination);
                o.start(ac.currentTime + i * 0.06);
                o.stop(ac.currentTime + i * 0.06 + 0.31);
            }
        } else if (type === 'ambient') {
            // Ambient creeak
            const o = ac.createOscillator();
            o.type = 'sine';
            o.frequency.setValueAtTime(80 + Math.random() * 40, ac.currentTime);
            o.frequency.linearRampToValueAtTime(50, ac.currentTime + 1.5);
            const g = ac.createGain();
            g.gain.setValueAtTime(0.05, ac.currentTime);
            g.gain.linearRampToValueAtTime(0, ac.currentTime + 1.5);
            o.connect(g);
            g.connect(ac.destination);
            o.start();
            o.stop(ac.currentTime + 1.6);
        } else if (type === 'heartbeat') {
            // Low heartbeat
            const o = ac.createOscillator();
            o.type = 'sine';
            o.frequency.value = 50;
            const g = ac.createGain();
            g.gain.setValueAtTime(0.4, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
            o.connect(g);
            g.connect(ac.destination);
            o.start();
            o.stop(ac.currentTime + 0.16);
        }
    } catch (e) {
        // Audio not available
    }
}

function startBGMusic() {
    if (bgPlaying) return;
    bgPlaying = true;
    try {
        const ac = getAC();
        const freqs = [40, 60, 80];
        freqs.forEach((f, i) => {
            const o = ac.createOscillator();
            o.type = i % 2 === 0 ? 'sine' : 'sawtooth';
            o.frequency.value = f;
            const g = ac.createGain();
            g.gain.value = 0.025;
            o.connect(g);
            g.connect(ac.destination);
            o.start();
            bgOscNodes.push(o);
        });
    } catch (e) {}
}

function stopBGMusic() {
    bgPlaying = false;
    bgOscNodes.forEach(o => {
        try {
            o.stop();
        } catch (e) {}
    });
    bgOscNodes = [];
}

// ── Particles & Effects ──────────────────────────────────────
function spawnBlood(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 20 + Math.random() * 30,
            maxLife: 50,
            color: Math.random() < 0.7 ? '#cc0000' : '#880000',
            radius: 2 + Math.random() * 3
        });
    }
    // Blood pool
    if (Math.random() < 0.5) {
        bloodPools.push({
            x: x + (Math.random() - 0.5) * 15,
            y: y + (Math.random() - 0.5) * 15,
            radius: 6 + Math.random() * 12,
            alpha: 0.4 + Math.random() * 0.3
        });
    }
}

function spawnMuzzleFlash(x, y) {
    for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * (2 + Math.random() * 4),
            vy: Math.sin(angle) * (2 + Math.random() * 4),
            life: 6,
            maxLife: 6,
            color: Math.random() < 0.6 ? '#ffdd00' : '#ff8800',
            radius: 2 + Math.random() * 3
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.85;
        p.vy *= 0.85;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

// ── Barrels (Obstacles) ──────────────────────────────────────
function generateBarrels() {
    barrels = [];
    const patterns = ['cluster', 'line', 'cross'];
    for (let attempt = 0; attempt < 50; attempt++) {
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        const baseX = 200 + Math.random() * (WORLD_WIDTH - 400);
        const baseY = 200 + Math.random() * (WORLD_HEIGHT - 400);

        // Don't spawn near player start
        if (Math.hypot(baseX - WORLD_WIDTH / 2, baseY - WORLD_HEIGHT / 2) < 300) continue;

        const group = [];
        if (pattern === 'cluster') {
            const n = 2 + Math.floor(Math.random() * 4);
            for (let i = 0; i < n; i++) {
                group.push({
                    x: baseX + (Math.random() - 0.5) * 100,
                    y: baseY + (Math.random() - 0.5) * 100,
                    radius: 30
                });
            }
        } else if (pattern === 'line') {
            const n = 3 + Math.floor(Math.random() * 3);
            const horiz = Math.random() < 0.5;
            for (let i = 0; i < n; i++) {
                group.push({
                    x: baseX + (horiz ? i * 50 : 0),
                    y: baseY + (horiz ? 0 : i * 50),
                    radius: 30
                });
            }
        } else if (pattern === 'cross') {
            for (let i = -2; i <= 2; i++) {
                group.push({
                    x: baseX + i * 50,
                    y: baseY,
                    radius: 30
                });
                if (i !== 0) {
                    group.push({
                        x: baseX,
                        y: baseY + i * 50,
                        radius: 30
                    });
                }
            }
        }
        barrels.push(...group);
    }
}

function barrelCollision(x, y, radius) {
    for (const b of barrels) {
        const dist = Math.hypot(x - b.x, y - b.y);
        if (dist < radius + b.radius) return b;
    }
    return null;
}

// ── Bullets ─────────────────────────────────────────────────
function fireBullet() {
    if (player.fireCooldown > 0) return;
    if (player.ammo[player.weapon] <= 0) {
        playSound('empty');
        player.fireCooldown = 8;
        return;
    }

    const wp = player.weapon === 'pistol' ? WEAPONS[0] : WEAPONS[1];
    const angle = player.angle;
    const dmgMult = player.activeEffects['damageboost'] ? 2 : 1;

    for (let i = 0; i < wp.pellets; i++) {
        const spreadAngle = angle + (Math.random() - 0.5) * wp.spread;
        bullets.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(spreadAngle) * 16,
            vy: Math.sin(spreadAngle) * 16,
            damage: wp.damage * dmgMult,
            life: 70
        });
    }

    player.ammo[player.weapon] -= wp.ammoUse;
    updateAmmoUI();
    player.fireCooldown = wp.fireRate;
    playSound(player.weapon);
    spawnMuzzleFlash(player.x, player.y);

    if (player.weapon === 'shotgun') {
        camera.shake.mag = 8;
        camera.shake.dur = 12;
    }
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        b.life--;

        // Out of bounds or lifetime expired
        if (b.life <= 0 || b.x < 0 || b.x > WORLD_WIDTH || b.y < 0 || b.y > WORLD_HEIGHT) {
            bullets.splice(i, 1);
            continue;
        }

        // Barrel collision
        if (barrelCollision(b.x, b.y, 3)) {
            bullets.splice(i, 1);
            continue;
        }

        // Zombie collision
        for (let j = zombies.length - 1; j >= 0; j--) {
            const z = zombies[j];
            if (Math.hypot(b.x - z.x, b.y - z.y) < z.radius + 5) {
                z.hp -= b.damage;
                spawnBlood(z.x, z.y, 5);
                bullets.splice(i, 1);
                if (z.hp <= 0) {
                    killZombie(j);
                }
                break;
            }
        }
    }
}

// ── Zombies ──────────────────────────────────────────────────
const ZOMBIE_COLORS = ['#2a5a18', '#3a6a20', '#1a4a10'];

function spawnZombie(isBoss = false) {
    let x, y, tries = 0;
    do {
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) {
            x = 100 + Math.random() * (WORLD_WIDTH - 200);
            y = 100;
        } else if (edge === 1) {
            x = 100 + Math.random() * (WORLD_WIDTH - 200);
            y = WORLD_HEIGHT - 100;
        } else if (edge === 2) {
            x = 100;
            y = 100 + Math.random() * (WORLD_HEIGHT - 200);
        } else {
            x = WORLD_WIDTH - 100;
            y = 100 + Math.random() * (WORLD_HEIGHT - 200);
        }
        tries++;
    } while (Math.hypot(x - player.x, y - player.y) < 250 && tries < 20);

    if (isBoss) {
        boss = {
            x,
            y,
            radius: 35,
            hp: 200 + bossCount * 80,
            maxHp: 200 + bossCount * 80,
            speed: 1.2 + bossCount * 0.15,
            state: 'chase',
            timer: 0,
            aggressive: true,
            color: '#660000',
            phase: 0
        };
    } else {
        const spd = 0.7 + difficulty * 0.2 + Math.random() * 0.3;
        const hp = 30 + difficulty * 5;
        zombies.push({
            x,
            y,
            radius: 18,
            hp,
            maxHp: hp,
            speed: spd,
            state: Math.random() < 0.4 ? 'wander' : 'chase',
            wanderAngle: Math.random() * Math.PI * 2,
            wanderTimer: 60 + Math.floor(Math.random() * 100),
            aggressive: false,
            color: ZOMBIE_COLORS[Math.floor(Math.random() * ZOMBIE_COLORS.length)],
            flashTimer: 0,
            phase: 0
        });
    }
}

function killZombie(index) {
    const z = zombies[index];
    player.score += 20 + Math.floor(difficulty * 5);
    if (player.score > player.highScore) player.highScore = player.score;
    scoreText.innerText = player.score;

    // Ammo drop
    if (Math.random() < 0.35) {
        player.ammo.pistol = Math.min(100, player.ammo.pistol + 8);
        if (Math.random() < 0.2) player.ammo.shotgun = Math.min(30, player.ammo.shotgun + 2);
        updateAmmoUI();
    }

    // Powerup drop
    if (Math.random() < 0.25) {
        spawnPowerup(z.x, z.y);
    }

    playSound('zombie_die');
    spawnBlood(z.x, z.y, 15);
    zombies.splice(index, 1);
}

function updateZombies() {
    // Regular zombies
    for (const z of zombies) {
        if (z.flashTimer > 0) z.flashTimer--;
        z.phase += 0.05;

        const dx = player.x - z.x;
        const dy = player.y - z.y;
        const dist = Math.hypot(dx, dy) || 1;

        // Flashlight detection
        const angleToZombie = Math.atan2(dy, dx);
        const angleDiff = Math.abs(angleToZombie - player.angle);
        const inFlashlight = angleDiff < 0.6 && dist < 600;

        if (inFlashlight) {
            z.speed = 3 + difficulty * 0.5;
            z.aggressive = true;
            z.state = 'chase';
        } else {
            z.speed = 0.8 + difficulty * 0.15;
            z.aggressive = false;
            if (z.state === 'wander') {
                z.wanderTimer--;
                if (z.wanderTimer <= 0) {
                    z.wanderAngle = Math.random() * Math.PI * 2;
                    z.wanderTimer = 80 + Math.floor(Math.random() * 100);
                }
                z.x += Math.cos(z.wanderAngle) * 0.5;
                z.y += Math.sin(z.wanderAngle) * 0.5;
            }
        }

        if (z.state === 'chase') {
            // Pathfinding around barrels
            let mx = dx / dist;
            let my = dy / dist;

            for (const b of barrels) {
                const bx = z.x - b.x;
                const by = z.y - b.y;
                const bd = Math.hypot(bx, by) || 1;
                if (bd < b.radius + z.radius + 30) {
                    const push = (b.radius + z.radius + 30 - bd) / (b.radius + z.radius + 30);
                    mx += (bx / bd) * push;
                    my += (by / bd) * push;
                }
            }

            const len = Math.hypot(mx, my) || 1;
            z.x += (mx / len) * z.speed;
            z.y += (my / len) * z.speed;
        }

        // Bounds
        z.x = Math.max(z.radius, Math.min(WORLD_WIDTH - z.radius, z.x));
        z.y = Math.max(z.radius, Math.min(WORLD_HEIGHT - z.radius, z.y));

        // Barrel collision push
        const bc = barrelCollision(z.x, z.y, z.radius);
        if (bc) {
            const px = z.x - bc.x || 0.1;
            const py = z.y - bc.y || 0.1;
            const pd = Math.hypot(px, py) || 1;
            z.x += (px / pd) * 3;
            z.y += (py / pd) * 3;
        }

        // Attack player
        if (dist < 40 && player.activeEffects['invincibility'] <= 0) {
            player.lives--;
            player.invTimer = 80;
            player.hitFlash = 20;
            camera.shake.mag = 6;
            camera.shake.dur = 10;
            playSound('player_hit');
            updateLives();
            if (player.lives <= 0) {
                gameOver();
            }
        }
    }

    // Boss
    if (boss) {
        boss.phase += 0.06;
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.hypot(dx, dy) || 1;

        let mx = dx / dist;
        let my = dy / dist;

        // Sinusoidal weave
        const weave = Math.sin(boss.phase) * 0.5;
        const perpX = -my;
        const perpY = mx;
        mx += perpX * weave;
        my += perpY * weave;

        const len = Math.hypot(mx, my) || 1;
        boss.x += (mx / len) * boss.speed;
        boss.y += (my / len) * boss.speed;

        boss.x = Math.max(boss.radius, Math.min(WORLD_WIDTH - boss.radius, boss.x));
        boss.y = Math.max(boss.radius, Math.min(WORLD_HEIGHT - boss.radius, boss.y));

        // Boss barrel push
        const bc = barrelCollision(boss.x, boss.y, boss.radius);
        if (bc) {
            const px = boss.x - bc.x || 0.1;
            const py = boss.y - bc.y || 0.1;
            const pd = Math.hypot(px, py) || 1;
            boss.x += (px / pd) * 4;
            boss.y += (py / pd) * 4;
        }

        // Boss attack
        boss.timer++;
        if (dist < 60 && boss.timer > 60 && player.activeEffects['invincibility'] <= 0) {
            player.lives--;
            player.invTimer = 90;
            player.hitFlash = 25;
            camera.shake.mag = 10;
            camera.shake.dur = 15;
            playSound('player_hit');
            updateLives();
            boss.timer = 0;
            if (player.lives <= 0) {
                gameOver();
            }
        }
    }
}

// ── Power-ups ────────────────────────────────────────────────
const POWERUP_TYPES = [
    { type: 'invincibility', color: '#ffffff', label: 'INV', duration: 300 },
    { type: 'rapidfire', color: '#ffee00', label: 'RF', duration: 360 },
    { type: 'ammocrate', color: '#00ff44', label: 'AMM', duration: 0 },
    { type: 'speed', color: '#00ffff', label: 'SPD', duration: 300 },
    { type: 'damageboost', color: '#ff00ff', label: 'DMG', duration: 240 }
];

function spawnPowerup(x, y) {
    if (Math.random() > 0.4) return;
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({
        x,
        y,
        ...type,
        life: 600,
        glow: 0
    });
}

function updatePowerups() {
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.life--;
        p.glow += 0.1;

        if (p.life <= 0) {
            powerups.splice(i, 1);
            continue;
        }

        if (Math.hypot(player.x - p.x, player.y - p.y) < 30) {
            playSound('powerup');
            if (p.type === 'ammocrate') {
                player.ammo.pistol = Math.min(100, player.ammo.pistol + 30);
                player.ammo.shotgun = Math.min(30, player.ammo.shotgun + 6);
            } else if (p.type === 'rapidfire') {
                player.activeEffects.rapidfire = p.duration;
            } else if (p.type === 'invincibility') {
                player.activeEffects.invincibility = p.duration;
            } else if (p.type === 'speed') {
                player.activeEffects.speed = p.duration;
            } else if (p.type === 'damageboost') {
                player.activeEffects.damageboost = p.duration;
            }
            updateAmmoUI();
            powerups.splice(i, 1);
        }
    }
}

// ── Player Update ────────────────────────────────────────────
const WEAPONS = [
    { name: 'PISTOL', fireRate: 12, damage: 18, spread: 0.08, pellets: 1, ammoUse: 1 },
    { name: 'SHOTGUN', fireRate: 45, damage: 25, spread: 0.4, pellets: 5, ammoUse: 2 }
];

function updatePlayer() {
    let moveX = 0;
    let moveY = 0;

    if (keys['w'] || keys['arrowup']) moveY -= player.speed;
    if (keys['s'] || keys['arrowdown']) moveY += player.speed;
    if (keys['a'] || keys['arrowleft']) moveX -= player.speed;
    if (keys['d'] || keys['arrowright']) moveX += player.speed;

    const spd = player.activeEffects.speed ? player.speed * 1.8 : player.speed;
    if (moveX || moveY) {
        const len = Math.hypot(moveX, moveY);
        moveX = (moveX / len) * spd;
        moveY = (moveY / len) * spd;
        player.walkCycle += 0.2;
    }

    let nx = player.x + moveX;
    let ny = player.y + moveY;

    // Barrel collision
    const bc = barrelCollision(nx, ny, player.radius);
    if (bc) {
        const pdx = nx - bc.x || 0.1;
        const pdy = ny - bc.y || 0.1;
        const pd = Math.hypot(pdx, pdy) || 1;
        nx += (pdx / pd) * (player.radius + bc.radius + 2 - pd);
        ny += (pdy / pd) * (player.radius + bc.radius + 2 - pd);
    }

    player.x = Math.max(player.radius, Math.min(WORLD_WIDTH - player.radius, nx));
    player.y = Math.max(player.radius, Math.min(WORLD_HEIGHT - player.radius, ny));

    // Angle to mouse (screen center relative)
    player.angle = Math.atan2(
        mouse.y - canvas.height / 2,
        mouse.x - canvas.width / 2
    );

    if (player.fireCooldown > 0) player.fireCooldown--;
    if (player.invTimer > 0) player.invTimer--;
    if (player.hitFlash > 0) player.hitFlash--;

    // Effect timers
    for (const key in player.activeEffects) {
        if (player.activeEffects[key] > 0) player.activeEffects[key]--;
    }
}

// ── Camera ───────────────────────────────────────────────────
function updateCamera() {
    const targetX = player.x - canvas.width / 2;
    const targetY = player.y - canvas.height / 2;

    camera.x += (targetX - camera.x) * camera.smoothness;
    camera.y += (targetY - camera.y) * camera.smoothness;

    camera.x = Math.max(0, Math.min(camera.x, WORLD_WIDTH - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, WORLD_HEIGHT - canvas.height));

    if (camera.shake.dur > 0) {
        camera.shake.x = (Math.random() - 0.5) * camera.shake.mag * 2;
        camera.shake.y = (Math.random() - 0.5) * camera.shake.mag * 2;
        camera.shake.mag *= 0.9;
        camera.shake.dur--;
    } else {
        camera.shake.x = 0;
        camera.shake.y = 0;
    }
}

// ── Difficulty & Spawning ────────────────────────────────────
function updateDifficulty() {
    difficulty = 1 + Math.floor(player.score / 200) * 0.08 + frameCount / 50000;
    spawnInterval = Math.max(40, 150 - player.score / 15 - frameCount / 400);

    spawnTimer--;
    if (spawnTimer <= 0) {
        const count = Math.min(1 + Math.floor(difficulty * 0.7), 5);
        for (let i = 0; i < count; i++) spawnZombie();
        spawnTimer = spawnInterval;
    }

    // Boss trigger
    if (!bossSpawned && player.score >= 500 + bossCount * 800) {
        bossSpawned = true;
        playSound('boss_spawn');
        setTimeout(() => spawnZombie(true), 500);
    }
}

// ── Ambient Effects ──────────────────────────────────────────
function updateAmbience() {
    ambientTimer--;
    if (ambientTimer <= 0) {
        playSound('ambient');
        ambientTimer = 300 + Math.floor(Math.random() * 500);
    }

    if (player.lives === 1) {
        heartbeatTimer--;
        if (heartbeatTimer <= 0) {
            playSound('heartbeat');
            heartbeatTimer = 60;
        }
    }
}

// ── Drawing Functions ────────────────────────────────────────
function drawFloor() {
    const tileSize = 200;
    const startX = Math.floor(camera.x / tileSize) * tileSize;
    const startY = Math.floor(camera.y / tileSize) * tileSize;

    for (let x = startX; x < startX + canvas.width + tileSize; x += tileSize) {
        for (let y = startY; y < startY + canvas.height + tileSize; y += tileSize) {
            const bright = ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0)
                ? '#191208'
                : '#140c04';
            ctx.fillStyle = bright;
            ctx.fillRect(
                x - camera.x - camera.shake.x,
                y - camera.y - camera.shake.y,
                tileSize,
                tileSize
            );
        }
    }
}

function drawBarrels() {
    for (const b of barrels) {
        const bx = b.x - camera.x - camera.shake.x;
        const by = b.y - camera.y - camera.shake.y;

        if (bx < -50 || bx > canvas.width + 50 || by < -50 || by > canvas.height + 50) continue;

        // Shadow
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(bx + 5, by + b.radius + 5, b.radius * 0.8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Barrel body
        ctx.fillStyle = '#4a3010';
        ctx.fillRect(bx - b.radius, by - b.radius, b.radius * 2, b.radius * 2);

        // Barrel bands
        ctx.fillStyle = '#2a1808';
        ctx.fillRect(bx - b.radius, by - 5, b.radius * 2, 3);
        ctx.fillRect(bx - b.radius, by + 5, b.radius * 2, 3);

        // Outline
        ctx.strokeStyle = '#1a0c00';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - b.radius, by - b.radius, b.radius * 2, b.radius * 2);
    }
}

function drawBloodPools() {
    for (const pool of bloodPools) {
        const px = pool.x - camera.x - camera.shake.x;
        const py = pool.y - camera.y - camera.shake.y;

        ctx.save();
        ctx.globalAlpha = pool.alpha * 0.5;
        ctx.fillStyle = '#660000';
        ctx.beginPath();
        ctx.ellipse(px, py, pool.radius, pool.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawParticles() {
    for (const p of particles) {
        const px = p.x - camera.x - camera.shake.x;
        const py = p.y - camera.y - camera.shake.y;

        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawPowerups() {
    for (const p of powerups) {
        const px = p.x - camera.x - camera.shake.x;
        const py = p.y - camera.y - camera.shake.y;

        if (px < -40 || px > canvas.width + 40 || py < -40 || py > canvas.height + 40) continue;

        const glow = 0.5 + Math.sin(p.glow) * 0.5;
        const alpha = Math.min(1, p.life / 100) * glow;

        // Glow
        ctx.save();
        ctx.globalAlpha = alpha * 0.6;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 25);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Icon
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(px - 8, py - 8, 16, 16);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(px - 8, py - 8, 16, 16);
        ctx.restore();
    }
}

function drawBullets() {
    ctx.fillStyle = '#ffee44';
    for (const b of bullets) {
        const bx = b.x - camera.x - camera.shake.x;
        const by = b.y - camera.y - camera.shake.y;

        if (bx < -5 || bx > canvas.width + 5 || by < -5 || by > canvas.height + 5) continue;

        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawZombie(z, x, y) {
    ctx.save();
    ctx.translate(x, y);

    const isFlashing = z.flashTimer > 0;
    const col = isFlashing ? '#ffffff' : z.color;
    const darkCol = isFlashing ? '#ffcccc' : '#1a2a08';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(2, z.radius + 3, z.radius * 0.9, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = col;
    ctx.fillRect(-z.radius, -z.radius, z.radius * 2, z.radius * 2);

    // Head
    ctx.fillStyle = darkCol;
    ctx.fillRect(-z.radius, -z.radius, z.radius * 2, z.radius * 1.2);

    // Eyes
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(-10, -z.radius + 4, 5, 5);
    ctx.fillRect(5, -z.radius + 4, 5, 5);

    // Mouth
    ctx.fillStyle = '#000';
    ctx.fillRect(-6, -2, 12, 3);

    ctx.restore();
}

function drawBoss() {
    const bx = boss.x - camera.x - camera.shake.x;
    const by = boss.y - camera.y - camera.shake.y;

    if (bx < -80 || bx > canvas.width + 80 || by < -80 || by > canvas.height + 80) return;

    ctx.save();
    ctx.translate(bx, by);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(3, boss.radius + 5, boss.radius * 0.95, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#660000';
    ctx.fillRect(-boss.radius, -boss.radius, boss.radius * 2, boss.radius * 2);

    // Head
    ctx.fillStyle = '#440000';
    ctx.fillRect(-boss.radius, -boss.radius, boss.radius * 2, boss.radius * 1.3);

    // Eyes glow
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(-15, -boss.radius + 5, 8, 8);
    ctx.fillRect(7, -boss.radius + 5, 8, 8);

    ctx.fillStyle = '#111';
    ctx.fillRect(-13, -boss.radius + 7, 4, 4);
    ctx.fillRect(9, -boss.radius + 7, 4, 4);

    // Mouth
    ctx.fillStyle = '#000';
    ctx.fillRect(-12, 8, 24, 8);
    ctx.fillStyle = '#ff0000';
    for (let i = 0; i < 4; i++) {
        ctx.fillRect(-10 + i * 6, 10, 4, 6);
    }

    // Arms
    ctx.fillStyle = '#660000';
    ctx.fillRect(-boss.radius - 10, -5, 10, boss.radius + 10);
    ctx.fillRect(boss.radius, -5, 10, boss.radius + 10);

    // HP bar
    ctx.fillStyle = '#111';
    ctx.fillRect(-boss.radius, -boss.radius - 20, boss.radius * 2, 8);
    const hpPercent = boss.hp / boss.maxHp;
    ctx.fillStyle = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffaa00' : '#ff0000';
    ctx.fillRect(-boss.radius, -boss.radius - 20, boss.radius * 2 * hpPercent, 8);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(-boss.radius, -boss.radius - 20, boss.radius * 2, 8);

    ctx.restore();
}

function drawPlayer() {
    const px = canvas.width / 2;
    const py = canvas.height / 2;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.angle);

    // Invincibility blink
    if (player.invTimer > 0 && Math.floor(player.invTimer / 5) % 2 === 0) {
        ctx.restore();
        return;
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(1, 15, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (walk cycle)
    const legX = Math.sin(player.walkCycle) * 5;
    ctx.fillStyle = '#3a2808';
    ctx.fillRect(-10, 5 + legX, 8, 15);
    ctx.fillRect(2, 5 - legX, 8, 15);

    // Body
    const bodyColor = player.hitFlash > 0 ? '#ff6666' : '#a07840';
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-11, -12, 22, 28);

    // Chest stripe
    ctx.fillStyle = player.hitFlash > 0 ? '#dd3333' : '#7a5a28';
    ctx.fillRect(-5, -8, 10, 5);

    // Head
    ctx.fillStyle = player.hitFlash > 0 ? '#dd8888' : '#c8a070';
    ctx.fillRect(-8, -22, 16, 12);

    // Eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-3, -18, 3, 3);
    ctx.fillRect(2, -18, 3, 3);

    // Flashlight on head
    ctx.fillStyle = '#ffdd88';
    ctx.fillRect(6, -24, 8, 4);
    ctx.fillStyle = 'rgba(255,220,100,0.2)';
    ctx.beginPath();
    ctx.moveTo(14, -22);
    ctx.lineTo(35, -32);
    ctx.lineTo(35, -12);
    ctx.closePath();
    ctx.fill();

    // Shield effect
    if (player.activeEffects.invincibility) {
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#aaaaff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

function drawFlashlight() {
    const px = canvas.width / 2;
    const py = canvas.height / 2;
    const angle = player.angle;
    const lightRange = 550;
    const spread = Math.PI / 3;

    // Full dark overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.94)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cut out light cone
    ctx.globalCompositeOperation = 'destination-out';
    const grad = ctx.createRadialGradient(px, py, 0, px, py, lightRange);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, lightRange, angle - spread, angle + spread);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.restore();

    // Light tint
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const tint = ctx.createRadialGradient(px, py, 0, px, py, lightRange * 0.8);
    tint.addColorStop(0, 'rgba(255,230,150,0.12)');
    tint.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, lightRange * 0.8, angle - spread, angle + spread);
    ctx.closePath();
    ctx.fillStyle = tint;
    ctx.fill();
    ctx.restore();
}

function drawHUD() {
    // Weapon box
    ctx.fillStyle = 'rgba(10,5,0,0.8)';
    ctx.fillRect(10, 10, 100, 50);
    ctx.strokeStyle = '#442200';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 100, 50);

    ctx.fillStyle = '#ff8800';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(WEAPONS[player.weapon === 'pistol' ? 0 : 1].name, 20, 30);

    // Weapon sprite
    if (player.weapon === 'pistol') {
        ctx.fillStyle = '#888';
        ctx.fillRect(25, 32, 20, 6);
        ctx.fillRect(42, 28, 8, 6);
    } else {
        ctx.fillStyle = '#888';
        ctx.fillRect(25, 33, 28, 5);
        ctx.fillRect(50, 30, 5, 10);
    }

    // Score
    ctx.fillStyle = '#ff8800';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SCORE: ' + player.score, canvas.width / 2, 30);

    ctx.fillStyle = '#884400';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('BEST: ' + player.highScore, canvas.width / 2, 48);

    // Lives indicator
    ctx.textAlign = 'right';
    ctx.fillStyle = player.lives > 1 ? '#ff3333' : '#ff0000';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('LIVES: ' + player.lives, canvas.width - 20, 30);

    // CRT scanlines
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#000';
    for (let y = 0; y < canvas.height; y += 2) {
        ctx.fillRect(0, y, canvas.width, 1);
    }
    ctx.restore();

    // Vignette
    const vig = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * 0.2,
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * 0.8
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Low health pulse
    if (player.lives === 1 && gameRunning) {
        const pulse = 0.05 + Math.abs(Math.sin(frameCount * 0.08)) * 0.15;
        ctx.fillStyle = `rgba(160,0,0,${pulse})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dripping blood
    for (let i = 0; i < 8; i++) {
        const drip = (frameCount * 2 + i * 60) % (canvas.height + 100) - 50;
        ctx.fillStyle = `rgba(${100 + i * 12},0,0,0.85)`;
        ctx.fillRect(50 + i * 80, drip, 4, 40);
        ctx.beginPath();
        ctx.arc(52 + i * 80, drip + 40, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Title
    if (Math.floor(frameCount / 20) % 2 === 0) {
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 80px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('YOU DIED', canvas.width / 2, 150);
    }

    // Score display
    ctx.fillStyle = '#ff6600';
    ctx.font = 'bold 40px monospace';
    ctx.fillText('SCORE: ' + player.score, canvas.width / 2, 250);

    ctx.fillStyle = '#884400';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('BEST: ' + player.highScore, canvas.width / 2, 310);

    // Instructions
    if (Math.floor(frameCount / 30) % 2 === 0) {
        ctx.fillStyle = '#ff3300';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('PRESS ENTER TO RESTART', canvas.width / 2, 400);
    }

    ctx.fillStyle = '#552200';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('M - MENU', canvas.width / 2, 450);
}

// ── Main Render ──────────────────────────────────────────────
function render() {
    ctx.fillStyle = '#0a0804';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawFloor();
    drawBarrels();
    drawBloodPools();

    for (const z of zombies) {
        const zx = z.x - camera.x - camera.shake.x;
        const zy = z.y - camera.y - camera.shake.y;
        if (zx > -40 && zx < canvas.width + 40 && zy > -40 && zy < canvas.height + 40) {
            drawZombie(z, zx, zy);
        }
    }

    if (boss) {
        drawBoss();
    }

    drawParticles();
    drawPowerups();
    drawBullets();
    drawPlayer();
    drawFlashlight();
    drawHUD();

    if (!gameRunning) {
        drawGameOver();
    }
}

// ── Game Logic ───────────────────────────────────────────────
function gameLoop() {
    frameCount++;

    if (gameRunning) {
        updatePlayer();
        updateCamera();
        updateBullets();
        updateZombies();
        updateParticles();
        updatePowerups();
        updateDifficulty();
        updateAmbience();
    }

    render();
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameRunning = false;
    stopBGMusic();
    gameOverTime = frameCount;
}

function updateLives() {
    livesUI.innerHTML = '';
    for (let i = 0; i < player.maxLives; i++) {
        const heart = document.createElement('span');
        heart.className = 'heart';
        heart.textContent = i < player.lives ? '❤️' : '🖤';
        livesUI.appendChild(heart);
    }
}

function updateAmmoUI() {
    ammoText.innerText = player.ammo[player.weapon];
    weaponIcon.innerHTML = '🔫';
}

// ── Event Listeners ──────────────────────────────────────────
window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    keys[key] = true;
    getAC();

    if (key === '1') {
        player.weapon = 'pistol';
        updateAmmoUI();
    }
    if (key === '2') {
        player.weapon = 'shotgun';
        updateAmmoUI();
    }
    if (key === ' ' && gameRunning) {
        fireBullet();
        e.preventDefault();
    }
    if (key === 'p' && gameRunning) {
        gameRunning = false;
    }
    if (key === 'p' && !gameRunning && frameCount - gameOverTime > 60) {
        gameRunning = true;
        startBGMusic();
    }
    if ((key === 'enter' || key === ' ') && !gameRunning && frameCount - gameOverTime > 60) {
        // Restart
        zombies = [];
        barrels = [];
        bullets = [];
        particles = [];
        bloodPools = [];
        powerups = [];
        boss = null;
        player.x = WORLD_WIDTH / 2;
        player.y = WORLD_HEIGHT / 2;
        player.lives = 3;
        player.score = 0;
        player.ammo = { pistol: 60, shotgun: 20 };
        player.activeEffects = {};
        frameCount = 0;
        difficulty = 1;
        bossSpawned = false;
        bossCount = 0;
        spawnTimer = 0;
        generateBarrels();
        updateLives();
        updateAmmoUI();
        gameRunning = true;
        startBGMusic();
    }
    if (key === 'm' && !gameRunning) {
        // Return to menu
        menu.classList.remove('hidden');
        hud.classList.add('hidden');
        gameRunning = false;
        stopBGMusic();
        zombies = [];
        barrels = [];
        bullets = [];
        particles = [];
        powerups = [];
        boss = null;
    }
});

window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

canvas.addEventListener('mousedown', () => {
    if (gameRunning) {
        fireBullet();
    } else if (!gameRunning && frameCount - gameOverTime > 60) {
        // Restart on click
        zombies = [];
        barrels = [];
        bullets = [];
        particles = [];
        bloodPools = [];
        powerups = [];
        boss = null;
        player.x = WORLD_WIDTH / 2;
        player.y = WORLD_HEIGHT / 2;
        player.lives = 3;
        player.score = 0;
        player.ammo = { pistol: 60, shotgun: 20 };
        player.activeEffects = {};
        frameCount = 0;
        difficulty = 1;
        bossSpawned = false;
        bossCount = 0;
        spawnTimer = 0;
        generateBarrels();
        updateLives();
        updateAmmoUI();
        gameRunning = true;
        startBGMusic();
    }
});

// ── Start Button ──────────────────────────────────────────────
startBtn.addEventListener('click', () => {
    menu.classList.add('hidden');
    hud.classList.remove('hidden');
    generateBarrels();
    updateLives();
    updateAmmoUI();
    startBGMusic();
    gameRunning = true;
    frameCount = 0;
    requestAnimationFrame(gameLoop);
});

quitBtn.addEventListener('click', () => {
    location.reload();
});

// Initialize
requestAnimationFrame(gameLoop);
