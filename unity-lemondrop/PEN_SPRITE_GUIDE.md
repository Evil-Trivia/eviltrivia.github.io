# Creating Pen Sprites for Lemon Drop

## Quick Option: Use Unity's Built-in Sprites

For prototyping, you can use Unity's basic shapes:

1. Create a new Sprite GameObject
2. Use a Capsule or Rectangle
3. Scale it to be pen-shaped: approximately 0.1 width x 0.5 height
4. Change color in Sprite Renderer to various pen colors:
   - Black (#000000)
   - Blue (#0000FF)
   - Red (#FF0000)
   - Dark Blue (#000080)
   - Green (#008000)

## Creating Pixel Art Pen Sprites

If you want custom pixel art pens, here's how to create them:

### Dimensions
- Canvas: 16x64 pixels (tall and thin)
- Or: 32x128 pixels for higher detail

### Pen Structure

```
[Top Cap - 4px circle]     #SAMECOLOR
[Body - main 50px]         #PENCOLOR (black, blue, red, etc)
[Metal tip - 6px cone]     #C0C0C0 (silver)
[Point - 4px triangle]     #FFD700 (gold/yellow)
```

### Color Variations

Create multiple pen colors for variety:
1. **Black Pen**: Body #000000, Cap #000000
2. **Blue Pen**: Body #0000FF, Cap #0000FF  
3. **Red Pen**: Body #FF0000, Cap #FF0000
4. **Dark Blue**: Body #000080, Cap #000080
5. **Green Pen**: Body #008000, Cap #008000

### Using Image Editing Software

#### Option 1: Aseprite (Recommended for Pixel Art)
1. Create new sprite: 16x64 pixels
2. Draw pen vertically
3. Use pencil tool (1px brush)
4. Export as PNG

#### Option 2: Photoshop/GIMP
1. New image: 16x64 pixels
2. Zoom in to 800% or more
3. Use Pencil Tool (1px, no anti-aliasing)
4. Turn off all smoothing/feathering
5. Save as PNG

#### Option 3: Online Pixel Art Tools
- Piskel (https://www.piskelapp.com/)
- Pixilart (https://www.pixilart.com/)
- Lospec (https://lospec.com/pixel-editor/)

### Simple Template

Here's ASCII art showing the pen layout:

```
Row 0-3:   ●●●●  (cap top - circle)
Row 4-50:  ████  (pen body - solid color)
Row 51-56: ▼▼▼▼  (metal tip - grey triangle)
Row 57-63: ▼▼    (point - gold/black thin triangle)
```

## Importing to Unity

1. Save all pen sprites as PNG files
2. Drag into Unity's Assets folder
3. Select each sprite and set:
   - **Texture Type**: Sprite (2D and UI)
   - **Pixels Per Unit**: 16 (or 32 if you used 32x128)
   - **Filter Mode**: Point (no filter)
   - **Compression**: None
   - **Max Size**: 64 (or 128)
4. Click Apply

## Creating the Pen Prefab with Sprite

1. Create GameObject > 2D Object > Sprite
2. Assign pen sprite
3. Add Rigidbody2D
4. Add Capsule Collider 2D (adjust to match sprite)
5. Add Pen script
6. Tag as "Pen"
7. Make it a prefab

## Random Pen Colors in Code

If you want to randomly color pens without multiple sprites, modify `PenSpawner.cs`:

```csharp
void SpawnPen()
{
    GameObject pen = Instantiate(penPrefab, spawnPosition, Quaternion.identity);
    
    // Random color
    Color[] penColors = new Color[] {
        Color.black,
        Color.blue,
        Color.red,
        new Color(0, 0, 0.5f), // dark blue
        Color.green
    };
    
    SpriteRenderer sr = pen.GetComponent<SpriteRenderer>();
    if (sr != null)
        sr.color = penColors[Random.Range(0, penColors.Length)];
}
```

## Pro Tips

- Keep pens simple and readable
- High contrast colors work best
- Outline in black for visibility
- Test at actual game size (small!)
- Use same pixel grid for all pens
- Export without any smoothing/anti-aliasing

## Need Help?

You can also:
- Use free pixel art assets from itch.io
- Commission a pixel artist
- Use AI image generators (specify "pixel art, 16x64, pen, no anti-aliasing")

