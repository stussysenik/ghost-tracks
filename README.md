# 👻 Ghost Tracks

> Don't just run a route. Reveal it.

Discover hidden shapes in city streets and create your own Strava art. Ghost Tracks reveals running routes that form recognizable shapes - animals, letters, and geometric patterns waiting to be traced.

![Ghost Tracks Preview](./static/og-image.png)

## Features

- **Discover Ghost Routes**: See pre-computed shapes overlaid on the map as faint "ghost" routes
- **Multiple Categories**: Filter by Creatures 🦊, Letters 🔤, or Geometric shapes ⭐
- **Distance Filtering**: Find routes that match your fitness level
- **AI Suggestions**: Describe your dream route and get intelligent matches
- **GPX Export**: Download routes to import into Strava, Garmin, Komoot, etc.
- **Share Routes**: Every route has a shareable link with rich previews
- **Mobile-First**: Optimized for on-the-go discovery

## Quick Start

### Prerequisites

- Node.js 20+
- A Mapbox account (free tier: 50k map loads/month)

### Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/ghost-tracks.git
cd ghost-tracks

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Add your Mapbox token to .env
# VITE_MAPBOX_ACCESS_TOKEN=pk.xxx

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to see the app.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_MAPBOX_ACCESS_TOKEN` | Yes | Mapbox GL JS access token |
| `AI_PROVIDER` | No | AI provider: `glm`, `gemini`, `kimi`, `claude` |
| `GLM_API_KEY` | No | GLM-4.7 API key |
| `GEMINI_API_KEY` | No | Google Gemini API key |
| `KIMI_API_KEY` | No | Kimi K2.5 API key |
| `ANTHROPIC_API_KEY` | No | Claude API key |

## Tech Stack

- **Frontend**: SvelteKit 2, Svelte 5, TypeScript
- **Maps**: Mapbox GL JS
- **Styling**: Tailwind CSS v4
- **GPX Export**: gpx-builder
- **Deployment**: Vercel (Edge Functions)

## Project Structure

```
src/
├── routes/
│   ├── +page.svelte          # Main map interface
│   ├── api/shapes/           # Shape API endpoints
│   └── shape/[id]/           # Shareable shape pages
├── lib/
│   ├── components/           # Svelte components
│   ├── data/                 # Prague shapes dataset
│   ├── services/             # GPX, AI services
│   └── types/                # TypeScript types
└── app.css                   # Global styles + Tailwind
```

## API Endpoints

### GET /api/shapes

Get shapes in viewport with filters.

```
/api/shapes?bbox=14.4,50.0,14.5,50.1&category=creature&distance_max=10
```

### GET /api/shapes/:id

Get single shape details.

### GET /api/shapes/:id/gpx

Download GPX file for a shape.

## Development

```bash
# Run dev server
npm run dev

# Type check
npm run check

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

This project is configured for Vercel with Edge Functions:

```bash
# Deploy to Vercel
vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

## Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Acknowledgments

- [Mapbox](https://mapbox.com) for beautiful maps
- [OpenStreetMap](https://openstreetmap.org) contributors for map data
- The Strava art community for inspiration

---

**Remember**: These suggestions are just starting points. When it comes to Strava art, the sky's the limit! 🚀
