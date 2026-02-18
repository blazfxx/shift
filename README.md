# Shift - Free Format Converter

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-orange.svg)](https://pages.cloudflare.com/)
[![FFmpeg.wasm](https://img.shields.io/badge/FFmpeg-wasm-green.svg)](https://github.com/ffmpegwasm/ffmpeg.wasm)
[![Privacy First](https://img.shields.io/badge/Privacy-First-blue.svg)](#security-features)

[![Website](https://img.shields.io/badge/Website-boxu.dev-blue.svg)](https://boxu.dev)
[![X/Twitter](https://img.shields.io/badge/X-@boxudev-black.svg)](https://x.com/boxudev)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2.svg)](https://discord.gg/cmPGdhXYxp)
[![GitHub](https://img.shields.io/badge/GitHub-blazfxx-181717.svg)](https://github.com/blazfxx)

A fast, privacy-focused file converter that runs entirely in your browser. No uploads, no servers, no tracking.

## Features

- **Drag and Drop / Click to Select** - Intuitive file selection with visual feedback
- **Client-Side Conversion** - All processing happens in your browser; files never leave your device
- **Multi-Format Support** - Convert images, videos, and audio files
- **Batch Conversion** - Process up to 10 files simultaneously
- **Completely Free** - No payment required, no hidden fees, no limits

## Supported Conversions

### Images
| Format | Extension |
|--------|-----------|
| PNG | `.png` |
| JPEG | `.jpg`, `.jpeg` |
| WebP | `.webp` |
| GIF | `.gif` |
| BMP | `.bmp` |
| ICO | `.ico` |

### Videos
| Format | Extension |
|--------|-----------|
| MP4 | `.mp4` |
| WebM | `.webm` |
| AVI | `.avi` |
| MOV | `.mov` |
| MKV | `.mkv` |

### Audio
| Format | Extension |
|--------|-----------|
| MP3 | `.mp3` |
| WAV | `.wav` |
| OGG | `.ogg` |
| FLAC | `.flac` |
| AAC | `.aac` |

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | WebAssembly port of FFmpeg for browser-based media conversion |
| [Cloudflare Pages](https://pages.cloudflare.com/) | Global edge hosting with automatic SSL |
| Vanilla JavaScript | Zero framework dependencies for maximum performance |

## Prerequisites

- **Node.js 18+** - For local development with Wrangler
- **Cloudflare Account** - Free tier works perfectly
- **Wrangler CLI** - Cloudflare's deployment tool

## Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/convertbox.git
   cd convertbox
   ```

2. **Install Wrangler globally**
   ```bash
   npm install -g wrangler
   ```

3. **Start development server**
   ```bash
   wrangler pages dev src
   ```

4. **Open in browser**
   ```
   http://localhost:8788
   ```

## Deployment to Cloudflare Pages

### Option 1: Git Integration (Recommended)

1. Push your code to GitHub
2. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. Navigate to **Pages** > **Create a project**
4. Select **Connect to Git**
5. Choose your repository
6. Configure build settings:
   - **Build command**: (leave empty)
   - **Build output directory**: `src`
7. Click **Save and Deploy**

### Option 2: Direct Deploy with Wrangler

```bash
wrangler pages deploy src
```

### Configure Custom Domain (Optional)

1. Go to your Pages project in Cloudflare Dashboard
2. Click **Custom domains**
3. Click **Set up a custom domain**
4. Enter your domain (e.g., `convert.yourdomain.com`)
5. Follow DNS configuration prompts

## Security Features

Shift is designed with security as a priority:

| Feature | Description |
|---------|-------------|
| **HTTPS/SSL** | Automatic SSL certificates via Cloudflare |
| **Content Security Policy** | Strict CSP headers prevent XSS attacks |
| **WAF** | Web Application Firewall protects against common threats |
| **Security Headers** | X-Frame-Options, X-Content-Type-Options, and more |
| **Privacy-First** | No server uploads; all processing is client-side |
| **Monitoring** | Cloudflare analytics and logging for threat detection |

### Security Headers Configured

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## WAF Setup Instructions

Enable Cloudflare's Web Application Firewall:

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your domain
3. Navigate to **Security** > **WAF**
4. Enable **Cloudflare Managed Ruleset**
5. Configure **Rate Limiting**:
   - Click **Rate Limiting Rules**
   - Create rule: Block requests exceeding 100/minute from same IP
   - Action: Block
   - Duration: 10 minutes

### Recommended WAF Rules

| Rule | Threshold | Action |
|------|-----------|--------|
| Rate Limit | 100 requests/minute | Block |
| Bot Fight Mode | On | Challenge |
| Browser Integrity Check | On | Block |

## Custom Domain Setup

1. In Cloudflare Dashboard, go to **Pages** > Your Project
2. Click **Custom domains** > **Set up a custom domain**
3. Enter your domain (must be on Cloudflare or transfer nameservers)
4. DNS records are configured automatically
5. SSL certificate provisions within minutes

## API for Automation (Future)

> **Note**: API endpoints are planned for future releases.

### Convert Endpoint

```
POST /api/convert
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | File to convert (multipart/form-data) |
| `format` | string | Yes | Target format (e.g., "mp4", "png", "mp3") |
| `quality` | string | No | Quality preset: "low", "medium", "high" |

### Authentication

```bash
curl -X POST https://convert.yourdomain.com/api/convert \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@input.avi" \
  -F "format=mp4"
```

### Response

```json
{
  "success": true,
  "download_url": "/download/converted-uuid.mp4",
  "expires_at": "2024-01-01T00:00:00Z"
}
```

## Project Structure

```
convertbox/
├── src/
│   ├── index.html          # Main HTML file
│   ├── css/
│   │   └── styles.css      # Styling
│   └── js/
│       └── app.js          # Application logic
├── README.md
└── LICENSE
```

## Browser Support

| Browser | Version |
|---------|---------|
| Chrome | 79+ |
| Firefox | 79+ |
| Safari | 14.1+ |
| Edge | 79+ |

> **Note**: WebAssembly and SharedArrayBuffer support required.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Test on multiple browsers before submitting
- Update documentation for new features
- Keep PRs focused and atomic

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0) - see the [LICENSE](LICENSE) file for details.

This license allows sharing and adapting the work, requires attribution, and **prohibits commercial use**.

## Connect

- **Website**: [boxu.dev](https://boxu.dev)
- **X/Twitter**: [@boxudev](https://x.com/boxudev)
- **Discord**: [Join our server](https://discord.gg/cmPGdhXYxp)
- **GitHub**: [blazfxx](https://github.com/blazfxx)

## Acknowledgments

- [FFmpeg](https://ffmpeg.org/) - The multimedia framework
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) - WebAssembly port
- [Cloudflare](https://www.cloudflare.com/) - Edge computing platform

---
