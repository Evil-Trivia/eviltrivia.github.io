# Lemon Drop Unity Setup Instructions

## 1. Create New Unity Project

1. Open Unity Hub
2. Click "New Project"
3. Select "2D (Core)" template
4. Name it "LemonDrop"
5. Click "Create Project"

## 2. Import Scripts

1. Copy all scripts from the `Scripts/` folder into your Unity project's `Assets/Scripts/` folder
2. The scripts you need are:
   - `GameManager.cs`
   - `LemonController.cs`
   - `PenSpawner.cs`
   - `Pen.cs`
   - `CameraController.cs`

## 3. Setup Lemon Sprite

1. Import `lemon.png` into Unity (drag into Assets folder)
2. Select the lemon sprite in the Inspector
3. Set these import settings:
   - **Sprite Mode**: Single
   - **Pixels Per Unit**: 100
   - **Filter Mode**: Point (no filter) - for pixel art
   - **Compression**: None
   - Click "Apply"

## 4. Create the Lemon GameObject

1. Create a new GameObject: `GameObject > 2D Object > Sprite`
2. Rename it to "Lemon"
3. Drag the lemon.png sprite onto the Sprite Renderer component
4. Add components (click "Add Component"):
   - **Rigidbody2D**:
     - Body Type: Dynamic
     - Mass: 1
     - Linear Drag: 0.5
     - Angular Drag: 0.05
     - Gravity Scale: 3
     - Collision Detection: Continuous
   - **Circle Collider 2D** (or Polygon Collider 2D for exact shape):
     - Adjust radius/shape to match lemon
   - **LemonController** (script)
     - Move Force: 5
     - Max Speed: 8

5. Create a child GameObject under Lemon called "GroundCheck":
   - Set position to (0, -0.5, 0) - at bottom of lemon
   - In LemonController script, drag this object to "Ground Check" field

## 5. Create the Pen Prefab

1. Create a pen sprite (or use a simple rectangle for now):
   - `GameObject > 2D Object > Sprite`
   - Rename to "Pen"
   
2. For a simple pen, add a Capsule or rectangle sprite:
   - Use a dark color (black/blue) for the body
   - Scale it to look like a pen (tall and thin, about 0.1 x 0.5)

3. Add components to Pen:
   - **Rigidbody2D**:
     - Body Type: Dynamic
     - Mass: 0.5
     - Gravity Scale: 1.5
     - Collision Detection: Continuous
   - **Capsule Collider 2D**:
     - Adjust size to match pen shape
   - **Pen** (script)
     - Lifetime: 10
     - Fall Speed Multiplier: 1
   
4. Add Tag "Pen":
   - Select Pen GameObject
   - In Inspector, click Tag dropdown > "Add Tag"
   - Create new tag called "Pen"
   - Go back to Pen GameObject and set Tag to "Pen"

5. Drag the Pen GameObject from Hierarchy into your Assets folder to make it a Prefab
6. Delete the Pen from the scene (we'll spawn them)

## 6. Create the Ground

1. Create: `GameObject > 2D Object > Sprite > Square`
2. Rename to "Ground"
3. Scale it: Set Transform Scale to (20, 1, 1) - wide and flat
4. Position: (0, -4.5, 0) - at bottom of screen
5. Change color: In Sprite Renderer, pick brown/dirt color (#654321)
6. Add components:
   - **Box Collider 2D**
   - Set Layer to "Ground" (create layer if needed)
7. Make it static in Inspector (checkbox at top)

## 7. Create Walls (Optional)

1. Create two invisible walls on left and right:
   - `GameObject > Create Empty`
   - Add **Box Collider 2D**
   - Position at screen edges: (-10, 0, 0) and (10, 0, 0)
   - Scale collider to be tall: (1, 20)

## 8. Setup Camera

1. Select Main Camera
2. Add **CameraController** script
3. Set Camera properties:
   - Projection: Orthographic
   - Size: 5
   - Background: Sky blue (#87CEEB)
4. Position: (0, 0, -10)

## 9. Create UI Canvas

1. Create: `GameObject > UI > Canvas`
2. Set Canvas to Scale with Screen Size:
   - UI Scale Mode: Scale With Screen Size
   - Reference Resolution: 1920 x 1080

### Score Text
1. Create: `GameObject > UI > Text - TextMeshPro` (under Canvas)
2. Rename to "ScoreText"
3. Settings:
   - Text: "TIME: 0s"
   - Font Size: 48
   - Alignment: Top Center
   - Color: Yellow (#FFD700)
   - Add black outline for readability
4. Position at top of screen (Anchor: Top Center)

### Game Over Panel
1. Create: `GameObject > UI > Panel` (under Canvas)
2. Rename to "GameOverPanel"
3. Make it dark/transparent black
4. Add child Text:
   - "GAME OVER!"
   - "TIME SURVIVED: 0 SECONDS"
   - Button "PLAY AGAIN"
5. Initially set panel to inactive (checkbox in Inspector)

## 10. Setup Game Manager

1. Create empty GameObject: "GameManager"
2. Add **GameManager** script
3. In Inspector, assign:
   - Score Text: Drag ScoreText UI element
   - Game Over Panel: Drag GameOverPanel
   - Final Score Text: Drag the score text in the panel

## 11. Setup Pen Spawner

1. Create empty GameObject: "PenSpawner"
2. Position at top of screen: (0, 6, 0)
3. Add **PenSpawner** script
4. In Inspector, assign:
   - Pen Prefab: Drag your Pen prefab
   - Spawn Interval: 1
   - Min Spawn Interval: 0.3
   - Spawn Height: 6
   - Spawn Min X: -8
   - Spawn Max X: 8

## 12. Setup Layers and Collision Matrix

1. Go to `Edit > Project Settings > Physics 2D`
2. Ensure proper collision:
   - Lemon collides with: Ground, Pen
   - Pen collides with: Lemon
   - Pen does NOT collide with: Ground (so pens fall through)

## 13. Play!

Press the Play button and test your game!

## 14. Build for WebGL (for website)

1. Go to `File > Build Settings`
2. Select "WebGL" platform
3. Click "Switch Platform"
4. Click "Build" and choose output folder
5. Upload the build folder to your website

## Pixel Art Tips

- Keep all sprites at low resolution (e.g., 64x64 or 128x128)
- Set all sprite import settings to:
  - Filter Mode: Point (no filter)
  - Compression: None
- Use Camera's Pixel Perfect settings for crisp rendering
- Consider using Unity's 2D Pixel Perfect package

## Next Steps

Once the basic game works:
- Add better pen sprites with multiple colors
- Add particle effects for lemon juice splatter
- Add background elements
- Add sound effects
- Add music
- Polish the UI with retro pixel fonts
- Add difficulty curve tweaking

