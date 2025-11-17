# 🍋 Lemon Drop - Unity Game

A fun 2D arcade game where you control a lemon and dodge falling pens!

## Game Description

- Control a rolling lemon using arrow keys or touch controls
- Dodge falling pens that rain from the sky
- Survive as long as possible - your score is based on time survived
- Game gets progressively harder (pens spawn faster, fall faster)
- Pixel art retro style

## Project Structure

```
unity-lemondrop/
├── Scripts/
│   ├── GameManager.cs       - Main game controller
│   ├── LemonController.cs   - Player movement and collision
│   ├── PenSpawner.cs        - Spawns pens from above
│   ├── Pen.cs               - Individual pen behavior
│   └── CameraController.cs  - Camera setup for pixel perfect
├── Sprites/
│   ├── lemon.png            - Lemon sprite
│   └── (add pen sprites)
├── SETUP_INSTRUCTIONS.md    - Detailed Unity setup guide
└── README.md                - This file
```

## Quick Start

1. Create new Unity 2D project
2. Import all scripts from `Scripts/` folder
3. Follow `SETUP_INSTRUCTIONS.md` for complete setup
4. Play and test!

## Controls

- **Arrow Keys** or **A/D** - Move left/right
- **Touch** - Tap left/right side of screen (mobile)

## Features

✅ Physics-based lemon rolling with proper collision detection
✅ Increasing difficulty over time
✅ Score tracking based on survival time
✅ Game over screen with restart option
✅ Pixel-perfect rendering for retro aesthetic
✅ Mobile touch controls
✅ WebGL build ready for website embedding

## Building for Web

1. File > Build Settings
2. Select WebGL platform
3. Switch Platform
4. Build
5. Upload to your web server

## Future Enhancements

- [ ] Firebase score submission
- [ ] Team name entry
- [ ] Bar location selection
- [ ] Leaderboard
- [ ] Particle effects for lemon juice
- [ ] Sound effects
- [ ] Background music
- [ ] Multiple pen types/colors
- [ ] Power-ups
- [ ] Background parallax

## Technical Notes

- Uses Unity's 2D physics system
- Circle/Polygon collider on lemon for accurate rolling
- Continuous collision detection to prevent pens passing through
- Dynamic difficulty scaling
- Optimized for WebGL performance

## Credits

Created for Evil Trivia

