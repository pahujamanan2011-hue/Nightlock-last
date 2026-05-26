🔦 NightLock: Last Light
A retro pixel-art 2D top-down horror survival shooter.
Survive the dark. Manage your ammo. Fear the boss.
🎮 Description
NightLock: Last Light is an infinite survival zombie shooter set inside a pitch-black abandoned warehouse. Armed only with a flashlight and two weapons, you must survive endless waves of the undead while managing scarce ammo, collecting power-ups, and eventually facing a powerful Boss enemy.
The game is fully browser-based — no installation required. Just open index.html.
🕹️ Controls
Input
Action
W A S D or Arrow Keys
Move
Mouse
Aim flashlight / direction
Left Click or Space
Shoot
1
Switch to Pistol
2
Switch to Shotgun
Scroll Wheel
Toggle weapon
P or Escape
Pause / Unpause
M
Return to Main Menu (from pause or game over)
Enter
Retry (from game over)
⚔️ Weapons
Weapon
Fire Rate
Damage
Ammo Use
Notes
Pistol
Fast
15
1
Accurate, rapid fire
Shotgun
Slow
22×5
2
Spread shot, screen shake
💊 Power-Ups
Power-ups drop from killed zombies. They glow and disappear if not collected quickly.
Icon
Type
Effect
INV
Invincibility
Immune to damage briefly
RF
Rapid Fire
Fire rate ×2.6
AMM
Ammo Crate
Instantly restores ammo
SPD
Speed Boost
Movement ×1.75
LGT
Light Boost
Flashlight radius ×1.5
DMG
Damage Boost
Weapon damage ×2.2
👾 Enemies
Zombies — Spawn on map edges, wander then chase. Speed and count increase over time.
Boss — Spawns at 600 score, then every 700 points after. Larger, faster, more HP each time. Has a sinusoidal weave movement pattern.
📊 Scoring
Kill
Points
Regular Zombie
10–30 (scales with difficulty)
Boss
600+ (scales each round)
High score is tracked per session (resets on page reload).
🗂️ Project Structure
Code
Note: All graphics and audio are currently synthesised procedurally in JavaScript. Drop your PNG/MP3 assets into the assets/ folder and update the asset references in game.js to use them.
🚀 GitHub Pages Deployment
Push this folder to a GitHub repository.
Go to Settings → Pages.
Set source to main branch, root /.
Your game will be live at https://<username>.github.io/<repo>/.
🛠️ Local Setup
No build step, no dependencies.
Bash
🎨 Visual Features
Triangular flashlight cone with soft gradient falloff
Flickering room ceiling lights with individual flicker rates
Persistent blood pool decals
Pixel particle blood splatter
Screen shake on shotgun fire and boss attacks
CRT scanline overlay
Screen vignette darkening
Minimap (bottom-right)
Low-health red screen pulse + heartbeat sound
Boss health bar + sinusoidal movement pattern
Power-up glow animation with pickup radius
🔊 Audio Features
All audio is synthesised with the Web Audio API (no MP3 files required):
Procedural pistol crack + noise burst
Deep shotgun boom with low-pass filtering
Zombie death groan with wave distortion
Player hit thud
Power-up ascending chime
Boss spawn rumble
Ambient room creaks
Heartbeat when at 1 HP
Background drone with LFO breathing
📝 Credits
Game Design & Programming
Manan Pahuja
Feedback / Contact
📧 pahujamanan2011@gmail.com
Tech Stack
Pure HTML5 Canvas + Vanilla JavaScript — no external libraries, no build tools.
"The light is fading. Keep moving."