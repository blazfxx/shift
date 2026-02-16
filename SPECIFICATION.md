# Shift - File Converter Specification

## Project Overview
**Name:** Shift  
**Tagline:** Free online file converter for images, videos, and audio  
**Core Value:** Simple, fast, private file conversion without accounts, watermarks, or sketchy upload servers.

**Problem Being Solved:**  
I was tired of shady file converter sites buried behind 47 ads, requiring newsletter signups, watermarking files, or just not working. I wanted to convert a PNG to JPG without jumping through hoops.

**Key Differentiators:**
- Actually free (no premium tiers hiding features)
- Private (files never leave the user's computer)
- Fast (no uploading to remote servers)
- Simple (no accounts, no watermarks)

## UI Design Scheme

### Color Palette (Dark Theme)
- **Background:** #09090b (near black)
- **Elevated Background:** #18181b
- **Card Background:** #27272a
- **Primary Text:** #fafafa (white)
- **Secondary Text:** #a1a1aa (gray)
- **Muted Text:** #71717a
- **Accent Color:** #22c55e (green)
- **Accent Hover:** #16a34a
- **Error:** #ef4444

### Typography
- **Font Family:** System fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)
- **Hero Title:** 2-3.5rem, weight 800, gradient text
- **Body Text:** 1rem, weight 400
- **Buttons:** 0.9375rem, weight 600

### Layout Structure

**Home Page (Two-Column Layout):**
```
[Navbar]
  Logo (left) | Converter | About | GitHub (right)

[Hero Section - Centered]
  "Free File Converter"
  "Convert images, videos & audio files instantly"

[Main Content - Two Column]
  Left Column (40%):
    - Headline: "Convert Any Format"
    - Subheadline with "100% Free" highlighted in green
    - Description text
    - Feature tags: Images, Videos, Audio (with icons)
  
  Right Column (60%):
    - Large drop zone (dashed border, 420px max-width)
    - Upload icon in green accent
    - "Click to upload or drag and drop"
    - "Supports PNG, JPG, MP4, MP3 & more"

[Footer]
  "Shift - Free Format Converter | Powered by FFmpeg WASM"
  Social icons: Website, X/Twitter, Discord, GitHub
```

**File List View (After Upload):**
```
[Same Navbar]

[Hero - Same but smaller]

[File List Section - Max 800px centered]
  Header: "Selected Files" | "X files" (count)
  
  File Items (repeated for each file):
    - Thumbnail preview (48x48px for images, icons for video/audio)
    - Filename (truncated if too long)
    - File size
    - "Convert to:" label
    - Format selector dropdown (dark styled)
    - Remove button (X icon)
    - Status icon (checkmark when done)
  
  [Progress Section - Hidden initially]
    "Converting files..." | "X%"
    Progress bar (green gradient)
    "X/Y files"
  
  [Download Section - Hidden initially]
    "Conversion Complete" with checkmark icon
    List of converted files with download buttons
  
  [Action Buttons]
    "Convert Files" (green, primary)
    "Add Files" (outlined, secondary)
    "Clear All" (outlined, secondary)
  
  [Status Message Area]
    Error messages in red
    Success messages in green
```

### Interactive Elements

**Drop Zone:**
- Dashed border (#3f3f46)
- Rounded corners (24px border-radius)
- Hover: Green border + glow effect
- Drag active: Green background tint
- Icon: Upload arrow in green circle

**Buttons:**
- Primary: Green background (#22c55e), white text, rounded-full (pill shape)
- Secondary: Transparent background, gray border, gray text, rounded-full
- Hover states: Slight lift (transform: translateY(-1px))

**File List Items:**
- Background: #18181b
- Border: 1px solid #27272a
- Border-radius: 12px
- Hover: Border color lightens
- Animation: slideIn on add

**Format Selector:**
- Dark background (#09090b)
- Custom arrow icon
- "Convert to:" label to the left
- Monospace font for format codes

### Responsive Behavior
- Mobile (<640px): Stack to single column, buttons full-width
- Tablet (<900px): Info section centered, upload above
- Desktop: Two-column layout as described

## Pages

**1. Converter (Home)**
- Two-column layout with upload area
- File list view appears after files added
- Supports drag-drop, click-to-select, and paste (Ctrl+V)

**2. About**
- Single column, max-width 700px
- Casual, human tone (NOT corporate/marketing speak)
- Explain why it exists (frustration with existing tools)
- Mention ownership of BOXU
- Links to GitHub for code
- Must allow scrolling (unlike main converter page)

**3. GitHub**
- External link to: https://github.com/blazfxx

## Technical Requirements

### Supported File Types
**Images:** PNG, JPG, JPEG, WEBP, GIF, BMP, ICO, SVG, TIFF  
**Videos:** MP4, WEBM, AVI, MOV, MKV, WMV, FLV, M4V, 3GP  
**Audio:** MP3, WAV, OGG, FLAC, AAC, M4A, WMA, OPUS

### Max Files: 10 per session

### Conversion Behavior
- Default target format: Different from source (e.g., PNG → JPG)
- Show format selector with available output formats
- Progress bar during conversion
- Download button appears when complete
- Individual download buttons for each file

### Key Features
1. **Image Previews:** Show actual thumbnail, not emoji icons
2. **Add More Files:** Button to add files after initial selection
3. **Paste Support:** Ctrl+V to paste images/files from clipboard
4. **Drag-Drop Anywhere:** Can drop files anywhere on page when in file view
5. **Logo Click:** Returns to upload view (clears current session)

## Platform Constraints & Recommendation

### Cloudflare Pages
**Limitations:**
- ❌ 25 MiB file size limit (ffmpeg-core.wasm is 30.6 MiB - TOO BIG)
- ❌ Complex CSP/CORS issues with Web Workers
- ❌ Requires COEP/COOP headers for SharedArrayBuffer

### Vercel
**Advantages:**
- ✅ 50 MiB file size limit (WASM fits!)
- ✅ Better WebAssembly support
- ✅ Simpler deployment
- ✅ No COEP headaches

**Recommendation:** Use Vercel

**Vercel Setup Instructions:**
1. Create `vercel.json` with:
   - Build command: `echo 'Static site - no build required'`
   - Output directory: `src`
   - CSP headers allowing blob: URLs for FFmpeg
2. Set framework preset to "Other"
3. Deploy

## Profile Links

**Website:** https://boxu.dev  
**GitHub:** https://github.com/blazfxx  
**X/Twitter:** https://x.com/boxudev  
**Discord:** https://discord.gg/cmPGdhXYxp

**About Page Copy Guidelines:**
- Use "I" not "we" (personal project)
- Casual tone: "Honestly? I got tired of shady file converter sites..."
- Mention: "I run BOXU" when introducing yourself
- Link @blazfxx to GitHub, BOXU to website
- Keep it conversational, not sales-y

## File Structure
```
src/
  index.html          # Main converter page
  about.html          # About page
  styles.css          # All styling
  main.js             # Converter logic
  ffmpeg/
    ffmpeg.js         # Main FFmpeg library (patched for local paths)
    ffmpeg-util.js    # FFmpeg utilities
    ffmpeg-core.js    # FFmpeg core (~111KB)
    ffmpeg-core.wasm  # FFmpeg WASM binary (~30.6MB)
    814.ffmpeg.js     # Worker thread (~3KB)
vercel.json           # Vercel deployment config
```

## Critical Implementation Notes

1. **No Upload Servers:** Emphasize files stay local (browser-based conversion)
2. **FFmpeg WASM:** Everything happens client-side using FFmpeg compiled to WebAssembly
3. **No Accounts:** Don't require login/signup
4. **Privacy First:** Make it clear files never leave the device
5. **Speed:** No network upload/download during conversion
6. **Dark Theme Only:** Don't implement light mode
7. **No Scroll on Main Page:** Keep converter on one screen
8. **Scroll on About:** About page needs scrolling

## Success Criteria
- User can drag-drop or click to select files
- User sees image previews (not emojis)
- User can select output format per file
- User clicks "Convert" and sees progress
- User can download converted files
- User can add more files after initial selection
- User can paste files with Ctrl+V
- Whole process feels instant and smooth
- No external dependencies except FFmpeg WASM files
