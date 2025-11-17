# Building Lemon Drop for WebGL and Embedding on Website

## Building from Unity

### 1. Install WebGL Build Support

If you haven't already:
1. Open Unity Hub
2. Click on your Unity version's settings (gear icon)
3. Select "Add Modules"
4. Check "WebGL Build Support"
5. Install

### 2. Configure WebGL Build Settings

1. In Unity: `File > Build Settings`
2. Select "WebGL" from the platform list
3. Click "Switch Platform" (wait for it to complete)
4. Click "Player Settings" button
5. Configure these settings:

#### Resolution and Presentation
- **Default Canvas Width**: 1920
- **Default Canvas Height**: 1080
- **Run In Background**: ✅ Checked

#### Publishing Settings
- **Compression Format**: Gzip (or Brotli for better compression)
- **Enable Exceptions**: None (for smaller build size)
- **Data Caching**: ✅ Checked

#### Other Settings
- **Color Space**: Linear (for better visuals)
- **Auto Graphics API**: ✅ Checked

### 3. Optimize for Web

Before building, optimize your game:

1. **Reduce Texture Sizes**:
   - Select all sprites
   - Max Size: 256 or 512 (not larger)
   - Compression: Compressed

2. **Optimize Code**:
   - Remove debug logs
   - Disable unused features

3. **Audio**:
   - Compress audio files
   - Use MP3 or Vorbis format

### 4. Build the Game

1. `File > Build Settings`
2. Click "Build"
3. Choose output folder (e.g., `WebGL-Build`)
4. Wait for build to complete (can take 5-15 minutes)

### 5. Test Locally

You can't just open index.html directly. You need a local server:

#### Option A: Unity's Built-in Server
- Unity will offer to start a local server when build completes
- Click "Run" to test

#### Option B: Python Server
```bash
cd WebGL-Build
python3 -m http.server 8000
```
Then open `http://localhost:8000` in browser

#### Option C: Node.js http-server
```bash
npm install -g http-server
cd WebGL-Build
http-server
```

## Embedding on Your Website

### Method 1: Using Unity's Embedded HTML

The build creates an `index.html` file with embed code. You can:

1. Copy the entire build folder to your web server
2. Link to it or iframe it:

```html
<iframe 
  src="/lemondrop/index.html" 
  width="960" 
  height="600" 
  frameborder="0"
  allowfullscreen>
</iframe>
```

### Method 2: Custom HTML Embed

Create a cleaner embed in your existing page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Evil Trivia - Lemon Drop</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: Arial, sans-serif;
    }
    
    #unity-container {
      width: 960px;
      height: 600px;
      position: relative;
    }
    
    #unity-canvas {
      width: 100%;
      height: 100%;
      background: #231F20;
    }
    
    #unity-loading-bar {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      display: none;
    }
    
    #unity-progress-bar-full {
      width: 0%;
      height: 18px;
      margin-top: 10px;
      background: #FFD700;
    }
    
    @media (max-width: 960px) {
      #unity-container {
        width: 100vw;
        height: 62.5vw; /* Maintain 960:600 ratio */
      }
    }
  </style>
</head>
<body>
  <div id="unity-container">
    <canvas id="unity-canvas"></canvas>
    <div id="unity-loading-bar">
      <div id="unity-progress-bar-empty">
        <div id="unity-progress-bar-full"></div>
      </div>
    </div>
  </div>

  <script>
    var container = document.querySelector("#unity-container");
    var canvas = document.querySelector("#unity-canvas");
    var loadingBar = document.querySelector("#unity-loading-bar");
    var progressBarFull = document.querySelector("#unity-progress-bar-full");

    var buildUrl = "Build";
    var loaderUrl = buildUrl + "/WebGL-Build.loader.js";
    var config = {
      dataUrl: buildUrl + "/WebGL-Build.data.gz",
      frameworkUrl: buildUrl + "/WebGL-Build.framework.js.gz",
      codeUrl: buildUrl + "/WebGL-Build.wasm.gz",
      streamingAssetsUrl: "StreamingAssets",
      companyName: "EvilTrivia",
      productName: "LemonDrop",
      productVersion: "1.0",
    };

    loadingBar.style.display = "block";

    var script = document.createElement("script");
    script.src = loaderUrl;
    script.onload = () => {
      createUnityInstance(canvas, config, (progress) => {
        progressBarFull.style.width = 100 * progress + "%";
      }).then((unityInstance) => {
        loadingBar.style.display = "none";
      }).catch((message) => {
        alert(message);
      });
    };
    document.body.appendChild(script);
  </script>
</body>
</html>
```

### Method 3: Inline in Existing Page

Add to your existing Evil Trivia page structure:

```html
<div class="game-container">
  <h1>🍋 LEMON DROP 🍋</h1>
  <div id="unity-container" class="unity-game">
    <canvas id="unity-canvas"></canvas>
  </div>
  <script src="lemondrop-build/Build/WebGL-Build.loader.js"></script>
  <script>
    // ... Unity initialization code ...
  </script>
</div>
```

## Uploading to Your Server

1. **Upload the Build Folder**:
   - Upload entire `Build/` folder to your server
   - Keep the folder structure intact
   - Path example: `/games/lemondrop/Build/`

2. **Set Correct MIME Types** (if needed):
   Your server needs to serve these file types:
   - `.wasm` → `application/wasm`
   - `.data.gz` → `application/gzip`
   - `.js.gz` → `application/gzip`
   - `.wasm.gz` → `application/gzip`

3. **Configure Compression**:
   If using gzip compression, ensure your server allows pre-compressed files

## Common Issues and Solutions

### Issue: Game doesn't load / White screen
**Solution**: Check browser console for errors. Usually a path issue.
- Verify `buildUrl` path is correct
- Check all files uploaded correctly

### Issue: Files taking too long to load
**Solution**: 
- Use Brotli compression instead of Gzip (smaller)
- Reduce texture sizes
- Enable server-side caching
- Use a CDN

### Issue: Game runs slowly
**Solution**:
- Build in Release mode (not Debug)
- Reduce canvas resolution
- Optimize sprites and textures
- Remove debug code

### Issue: Can't fullscreen
**Solution**: Add to canvas config:
```javascript
config.matchWebGLToCanvasSize = true;
```

## Firebase Integration (Later)

When ready to add score submission:

1. Add Firebase SDK to your HTML page
2. Modify `GameManager.cs` to call JavaScript:
```csharp
[DllImport("__Internal")]
private static extern void SubmitScore(string teamName, int score);

public void SubmitToFirebase()
{
    #if UNITY_WEBGL && !UNITY_EDITOR
    SubmitScore(teamName, score);
    #endif
}
```

3. Add JavaScript function in HTML:
```javascript
function SubmitScore(teamName, score) {
  // Firebase code here
  firebase.database().ref('games/lemondrop/').push({
    teamName: teamName,
    score: score,
    timestamp: Date.now()
  });
}
```

## Performance Tips

- Target 60 FPS on desktop, 30 FPS on mobile
- Keep draw calls low (under 100)
- Use object pooling for pens instead of Instantiate/Destroy
- Batch sprite rendering
- Use compressed textures
- Minimize canvas size on mobile

## Testing Checklist

Before deploying:
- ✅ Test on Chrome, Firefox, Safari
- ✅ Test on mobile devices
- ✅ Test touch controls work
- ✅ Check loading time (should be under 10 seconds)
- ✅ Verify game runs at stable FPS
- ✅ Test fullscreen mode
- ✅ Check all UI is visible and readable

## Going Live

1. Upload build files to server
2. Update your main site to link to the game
3. Add to your games list at `/games/index.html`
4. Test the live version
5. Share with players!

