# 🍋 Lemon Drop Quick Start Checklist

Follow this checklist to get your game running in Unity!

## ☐ Step 1: Create Unity Project
- [ ] Open Unity Hub
- [ ] New Project → 2D (Core) template
- [ ] Name: "LemonDrop"
- [ ] Click Create Project

## ☐ Step 2: Import Files
- [ ] Create folder: `Assets/Scripts`
- [ ] Copy all 5 scripts from `Scripts/` folder
- [ ] Create folder: `Assets/Sprites`  
- [ ] Copy `lemon.png` to Sprites folder

## ☐ Step 3: Configure Lemon Sprite
- [ ] Select `lemon.png` in Unity
- [ ] Sprite Mode: Single
- [ ] Pixels Per Unit: 100
- [ ] Filter Mode: Point (no filter)
- [ ] Compression: None
- [ ] Click Apply

## ☐ Step 4: Create Lemon GameObject
- [ ] GameObject → 2D Object → Sprite
- [ ] Rename to "Lemon"
- [ ] Drag lemon.png onto Sprite Renderer
- [ ] Add Component: Rigidbody2D
  - [ ] Mass: 1
  - [ ] Gravity Scale: 3
  - [ ] Collision Detection: Continuous
- [ ] Add Component: Circle Collider 2D
- [ ] Add Component: LemonController script
- [ ] Create child object "GroundCheck"
  - [ ] Position: (0, -0.5, 0)
  - [ ] Drag to LemonController's Ground Check field

## ☐ Step 5: Create Pen Prefab
- [ ] GameObject → 2D Object → Sprite → Capsule
- [ ] Rename to "Pen"
- [ ] Scale: (0.1, 0.5, 1)
- [ ] Change color to black or blue
- [ ] Add Component: Rigidbody2D
  - [ ] Gravity Scale: 1.5
  - [ ] Collision Detection: Continuous
- [ ] Add Component: Capsule Collider 2D
- [ ] Add Component: Pen script
- [ ] Create Tag "Pen" (Inspector → Tag → Add Tag)
- [ ] Set Pen's tag to "Pen"
- [ ] Drag Pen into Assets folder (makes prefab)
- [ ] Delete Pen from scene

## ☐ Step 6: Create Ground
- [ ] GameObject → 2D Object → Sprite → Square
- [ ] Rename to "Ground"
- [ ] Transform Scale: (20, 1, 1)
- [ ] Position: (0, -4.5, 0)
- [ ] Change color to brown (#654321)
- [ ] Add Component: Box Collider 2D
- [ ] Create Layer "Ground" and assign
- [ ] Check Static in Inspector

## ☐ Step 7: Setup Camera
- [ ] Select Main Camera
- [ ] Add Component: CameraController script
- [ ] Set Camera Background: Sky blue (#87CEEB)
- [ ] Orthographic Size: 5
- [ ] Position: (0, 0, -10)

## ☐ Step 8: Create UI
- [ ] GameObject → UI → Canvas
  - [ ] Canvas Scaler: Scale With Screen Size
  - [ ] Reference Resolution: 1920 x 1080
- [ ] Create UI → Text - TextMeshPro (say yes to import TMP)
  - [ ] Rename to "ScoreText"
  - [ ] Text: "TIME: 0s"
  - [ ] Font Size: 48
  - [ ] Color: Yellow
  - [ ] Anchor: Top Center
  - [ ] Position: (0, -50, 0)
- [ ] Create UI → Panel
  - [ ] Rename to "GameOverPanel"
  - [ ] Color: Black with transparency
  - [ ] Add child Text: "GAME OVER!"
  - [ ] Add child Text: "TIME SURVIVED: 0 SECONDS" (rename FinalScoreText)
  - [ ] Add child Button: "PLAY AGAIN"
  - [ ] Set panel to inactive (uncheck in Inspector)

## ☐ Step 9: Setup Game Manager
- [ ] GameObject → Create Empty
- [ ] Rename to "GameManager"
- [ ] Add Component: GameManager script
- [ ] Drag ScoreText to Score Text field
- [ ] Drag GameOverPanel to Game Over Panel field
- [ ] Drag FinalScoreText to Final Score Text field

## ☐ Step 10: Setup Pen Spawner
- [ ] GameObject → Create Empty
- [ ] Rename to "PenSpawner"
- [ ] Position: (0, 6, 0)
- [ ] Add Component: PenSpawner script
- [ ] Drag Pen prefab to Pen Prefab field
- [ ] Set values:
  - [ ] Spawn Interval: 1
  - [ ] Min Spawn Interval: 0.3
  - [ ] Spawn Height: 6
  - [ ] Spawn Min X: -8
  - [ ] Spawn Max X: 8

## ☐ Step 11: Configure Physics
- [ ] Edit → Project Settings → Physics 2D
- [ ] Create Layers if needed:
  - [ ] Layer 6: Ground
  - [ ] Layer 7: Player (for Lemon)
  - [ ] Layer 8: Pen
- [ ] Set up collision matrix (optional - default works)

## ☐ Step 12: Wire Up Restart Button
- [ ] Select "PLAY AGAIN" button
- [ ] In Button component → On Click ()
- [ ] Drag GameManager object
- [ ] Select Function: GameManager.RestartGame

## ☐ Step 13: Test!
- [ ] Press Play button
- [ ] Test arrow key controls
- [ ] Check pens spawn and fall
- [ ] Test collision (let pen hit lemon)
- [ ] Verify game over screen appears
- [ ] Test restart button

## ☐ Troubleshooting Checklist
If something doesn't work:
- [ ] Check all scripts have no compile errors (bottom of Unity)
- [ ] Verify all fields are assigned in Inspector (none say "None")
- [ ] Check Lemon has Rigidbody2D and Collider
- [ ] Check Pen prefab has Rigidbody2D and Collider
- [ ] Verify Pen prefab is assigned to PenSpawner
- [ ] Check Ground has Collider
- [ ] Verify Camera can see the scene (proper position/size)
- [ ] Check Console for error messages (Window → General → Console)

## ☐ Step 14: Build for WebGL (Optional)
- [ ] File → Build Settings
- [ ] Select WebGL
- [ ] Switch Platform (wait for it)
- [ ] Player Settings → Configure settings
- [ ] Click Build
- [ ] Choose output folder
- [ ] Wait for build (5-15 minutes)
- [ ] Test in browser

## Common Issues

### Lemon doesn't move
- Check LemonController is attached
- Check Rigidbody2D is present
- Verify controls in Update() method

### Pens don't spawn
- Check PenSpawner has Pen Prefab assigned
- Check GameManager is active
- Look for errors in Console

### No collision detection
- Both objects need Colliders
- Both objects need Rigidbody2D (or one static)
- Check Pen has "Pen" tag
- Verify Collision Detection is Continuous

### UI not visible
- Check Canvas is present
- Verify Camera is rendering UI layer
- Check text colors aren't same as background

### Game Over doesn't show
- Check GameOverPanel is assigned
- Verify panel has CanvasGroup (if using fade)
- Check FinalScoreText is assigned

## Next Steps

Once working:
- [ ] Add more pen colors/types
- [ ] Create particle effects
- [ ] Add sound effects
- [ ] Polish UI with pixel fonts
- [ ] Add difficulty tweaks
- [ ] Test on mobile
- [ ] Build and deploy to website

## Need Help?

- Check Unity Console for errors
- Read the SETUP_INSTRUCTIONS.md for details
- Review each script's comments
- Test each step individually
- Use Debug.Log() to trace issues

