# 🍋 START HERE - Lemon Drop Unity Game

Welcome! I've created a complete Unity game project for Lemon Drop. Here's everything you need to know.

## 📁 What's Included

```
unity-lemondrop/
├── Scripts/                    # All game code
│   ├── GameManager.cs         # Main game controller ⭐ REQUIRED
│   ├── LemonController.cs     # Player controls ⭐ REQUIRED
│   ├── PenSpawner.cs          # Simple spawner ⭐ REQUIRED
│   ├── Pen.cs                 # Pen behavior ⭐ REQUIRED
│   ├── CameraController.cs    # Camera setup ⭐ REQUIRED
│   ├── ObjectPool.cs          # Performance optimization (optional)
│   ├── PenSpawnerOptimized.cs # Better spawner (optional upgrade)
│   └── PenOptimized.cs        # Better pen (optional upgrade)
│
├── Sprites/
│   └── lemon.png              # Your lemon sprite
│
├── 📖 Documentation
│   ├── START_HERE.md          # This file
│   ├── QUICK_START_CHECKLIST.md  # Step-by-step setup ⭐ USE THIS
│   ├── SETUP_INSTRUCTIONS.md     # Detailed explanations
│   ├── PEN_SPRITE_GUIDE.md       # How to create pen art
│   ├── WEBGL_BUILD_GUIDE.md      # Deploy to website
│   └── README.md                 # Project overview
```

## 🚀 Quick Start (5 Minutes)

### Option 1: Follow the Checklist (Recommended)
**Open `QUICK_START_CHECKLIST.md` and follow each checkbox step-by-step.**

This is the fastest way to get running!

### Option 2: Manual Setup
1. Create new Unity 2D project named "LemonDrop"
2. Copy all files from `Scripts/` into `Assets/Scripts/`
3. Copy `lemon.png` into `Assets/Sprites/`
4. Follow `SETUP_INSTRUCTIONS.md`

## 🎮 Game Features

### What Works Out of the Box
✅ Lemon rolling physics with proper collision
✅ Keyboard controls (arrow keys)
✅ Touch controls for mobile
✅ Falling pens that spawn from above
✅ Collision detection (game over on hit)
✅ Score tracking (time survived)
✅ Game over screen with restart
✅ Increasing difficulty over time
✅ Pixel-perfect rendering for retro look

### What You Need to Add
🔧 Pen sprites (use built-in shapes or create pixel art)
🔧 UI styling (basic text is included)
🔧 Background elements (optional)

## 📋 Two Versions Available

### Basic Version (Start Here)
Use these scripts first:
- `GameManager.cs`
- `LemonController.cs`
- `PenSpawner.cs`
- `Pen.cs`
- `CameraController.cs`

**Pros**: Simple, easy to understand
**Cons**: Creates/destroys objects (slightly slower)

### Optimized Version (Upgrade Later)
Replace these after testing:
- `PenSpawner.cs` → `PenSpawnerOptimized.cs`
- `Pen.cs` → `PenOptimized.cs`
- Add `ObjectPool.cs`

**Pros**: Better performance, smoother gameplay
**Cons**: Slightly more complex

## 🎯 Recommended Order

1. **Week 1: Get it Working**
   - Follow QUICK_START_CHECKLIST.md
   - Get basic game running
   - Test controls and collision

2. **Week 2: Make it Pretty**
   - Create/add pen sprites (see PEN_SPRITE_GUIDE.md)
   - Polish UI with pixel fonts
   - Add background color/elements
   - Tune difficulty

3. **Week 3: Deploy**
   - Build for WebGL (see WEBGL_BUILD_GUIDE.md)
   - Test in browser
   - Upload to website
   - Integrate with your site design

4. **Week 4: Add Features**
   - Switch to optimized scripts
   - Add particle effects
   - Add sound effects
   - Firebase integration for scores

## 🔧 Key Settings to Adjust

### Difficulty (in GameManager)
- `speedIncreaseRate`: How fast game speeds up (0.05)
- `speedIncreaseInterval`: Time between increases (5s)

### Pen Spawning (in PenSpawner)
- `spawnInterval`: Starting spawn rate (1s)
- `minSpawnInterval`: Fastest spawn rate (0.3s)
- `spawnIntervalDecrease`: How much faster per spawn (0.05s)

### Lemon Controls (in LemonController)
- `moveForce`: How strong controls are (5)
- `maxSpeed`: Maximum rolling speed (8)

### Camera (in CameraController)
- `pixelsPerUnit`: Pixel density (16)
- Camera `orthographicSize`: Zoom level (5)

## ❗ Common First-Time Issues

### "Scripts won't compile"
- Make sure all 5 required scripts are in Unity
- Check you imported TextMeshPro (Window → TextMeshPro → Import)

### "Lemon doesn't move"
- Verify Rigidbody2D is attached
- Check gravity scale is > 0
- Make sure LemonController script is attached

### "No pens spawning"
- Assign pen prefab in PenSpawner
- Check GameManager is in scene
- Look at Console for errors

### "Collision doesn't work"
- Both objects need colliders
- Pen needs "Pen" tag
- Check collision detection is "Continuous"

### "Can't see anything"
- Check camera position (0, 0, -10)
- Verify camera size (5 is good default)
- Make sure objects are at Z = 0

## 📚 Documentation Guide

| Document | When to Read |
|----------|-------------|
| START_HERE.md | Right now! (you're reading it) |
| QUICK_START_CHECKLIST.md | Setting up for first time |
| SETUP_INSTRUCTIONS.md | Need detailed explanations |
| PEN_SPRITE_GUIDE.md | Creating art assets |
| WEBGL_BUILD_GUIDE.md | Ready to publish |
| README.md | Overview of project |

## 🎨 Art Style Notes

This game uses **pixel art** style:
- Low resolution sprites
- No anti-aliasing
- Point filtering on textures
- Crisp, retro look

Keep all sprites small (16x16 to 128x128 pixels).

## 💡 Pro Tips

1. **Test frequently** - Press Play often to catch issues early
2. **Use Console** - Window → General → Console shows errors
3. **Save scenes** - File → Save Scene regularly
4. **Backup project** - Copy entire folder before major changes
5. **Start simple** - Get basic version working before optimizing
6. **Read comments** - All scripts have helpful comments

## 🐛 Debugging Tips

If something breaks:
1. Check Unity Console (bottom of screen)
2. Click error message to see which line
3. Look for "NullReferenceException" (something not assigned)
4. Verify all Inspector fields are filled
5. Try creating fresh prefabs
6. Restart Unity (sometimes helps!)

## 🔄 Next Steps

### Right Now
1. Open QUICK_START_CHECKLIST.md
2. Create Unity project
3. Follow checklist step-by-step
4. Get game running!

### After It Works
1. Test thoroughly
2. Create pen sprites
3. Polish UI
4. Build for WebGL
5. Deploy to website

### Future Updates
1. Add Firebase scores
2. Team name entry
3. Bar location selector
4. Leaderboard
5. More game modes

## 📞 Need Help?

If you get stuck:
- Read the error message in Console
- Check that document's troubleshooting section
- Review script comments
- Try starting fresh with checklist
- Test each component separately

## 🎉 Ready?

**Open QUICK_START_CHECKLIST.md and let's build this game!**

The checklist has checkboxes for every step - just follow it top to bottom and you'll have a working game in no time.

Good luck! 🍋

