# Lane Defense

**Play it on your phone:** https://nadavw9.github.io/lane-defense/

A hybrid-casual mobile tower-defense game. Drag color-coded shooters into lanes to destroy advancing cars before they breach. Survive the timer to win.

---

## Playing on Your Phone

Open this URL in any mobile browser (Chrome, Safari):

```
https://nadavw9.github.io/lane-defense/
```

The game deploys automatically every time a commit is pushed to `master`. No app store, no install needed.

---

## How to Push So the Game Updates on Your Phone

Every push to `master` triggers a GitHub Actions build and redeploys the game. The steps are always the same regardless of where you're working:

```bash
# 1. Make your changes

# 2. Commit
git add -A
git commit -m "your message"

# 3. Push — this triggers the deployment automatically
git push origin master
```

**That's it.** Within ~2 minutes the live URL is updated.

### Check deployment status

If the game doesn't update, check the Actions tab:
```
https://github.com/nadavw9/lane-defense/actions
```

A green ✓ means deployed. A red ✗ means the build failed — click it to see the error.

---

## Common reasons a push doesn't deploy

| Problem | Fix |
|---|---|
| Build failed (red ✗ in Actions) | Check the Actions log — usually a JS syntax error |
| Game loads but shows old version | Hard-refresh on phone (hold reload button → "Hard Reload") |
| 404 on the URL | Go to **Settings → Pages → Source** and make sure it's set to **GitHub Actions** |
| Push rejected | Your SSH key may not be added to GitHub — see [SSH setup](#ssh-setup) |

---

## SSH Setup (if pushing from a new machine)

```bash
# Check if you have a key
cat ~/.ssh/id_rsa.pub

# If not, generate one
ssh-keygen -t rsa -b 4096

# Show the public key, then add it to github.com/settings/keys
cat ~/.ssh/id_rsa.pub

# Add GitHub to known hosts (first time only)
ssh-keyscan github.com >> ~/.ssh/known_hosts

# Set the remote to SSH
git remote set-url origin git@github.com:nadavw9/lane-defense.git

# Test
git push origin master
```

---

## Local Development

Requires Node.js 18+.

```bash
npm install        # first time only
npm run dev        # starts dev server at http://localhost:5173
```

To test on phone over local WiFi:
```bash
npm run dev        # already uses --host flag
# Open the Network URL shown in terminal (e.g. http://192.168.1.x:5173)
```

To build the production bundle:
```bash
npm run build      # outputs to dist/
```

---

## Project Structure

```
src/
├── director/      AI that controls car spawning and shooter generation
├── models/        Car, Lane, Column, Shooter — pure data
├── game/          GameLoop, GameState, CombatResolver, LevelManager, Achievements
├── renderer/      PixiJS 2D renderer (meta-screens: title, win, lose, shop…)
├── renderer3d/    Three.js 3D renderer (active during gameplay)
├── input/         DragDrop, InputManager
├── audio/         Synthesized Web Audio API sounds (no asset files needed)
├── screens/       All UI screens
└── analytics/     Firebase anonymous session tracking + AutoTuner
tests/             Vitest test suite (414 test cases)
```

## Tech Stack

- **PixiJS v8** — meta-screen rendering
- **Three.js** — 3D gameplay renderer
- **Howler.js** / **Web Audio API** — synthesized audio
- **Vite** — build tool
- **Vitest** — tests
- **Capacitor** — Android packaging (see `android/`)
