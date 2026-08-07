# GIS Infrastructure Monitor

A real-time road maintenance operations dashboard with predictive analytics, built with Next.js 16 and Mapbox GL. This application provides infrastructure monitoring capabilities for detecting and managing road anomalies such as potholes, bumps, and surface defects.

## Features

- **Interactive Map Visualization**: Real-time map display using Mapbox GL with multiple style options (Dark, Night Navigation, Satellite, Streets)
- **Live Incident Feed**: Real-time detection and display of road anomalies with severity classification (HIGH, MED, LOW)
- **Spatial Analytics**: GPS-based incident tracking with fly-to navigation and custom markers
- **Dashboard KPIs**: Key performance indicators including:
  - Critical Potholes count
  - Major Bumps count
  - Road Health Index percentage
  - Active Data Collectors count
- **Map Controls**: Zoom in/out, reset location, and toggle between map styles
- **Responsive Design**: Built with Tailwind CSS v4 for a modern, responsive UI

## Tech Stack

- **Framework**: Next.js 16.3.0 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **Mapping**: Mapbox GL v3.28.1
- **React**: 19.2.8
- **Linting**: ESLint v9

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm, yarn, pnpm, or bun
- A [Mapbox Access Token](https://account.mapbox.com/) (free tier available)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Create a `.env.local` file in the root directory and add your Mapbox token:

```env
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
```

Alternatively, you can enter your token directly in the application's UI when prompted.

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── dashboard/
│   │   └── page.tsx          # Main dashboard page with map and incident feed
│   ├── globals.css           # Global styles and Tailwind configuration
│   ├── layout.tsx            # Root layout component
│   └── page.tsx              # Home page with navigation links
├── components/
│   └── MapboxMap.tsx         # Reusable Mapbox map component with custom markers
├── public/
│   └── dashboard.html        # Static HTML version of the dashboard
├── next.config.ts            # Next.js configuration
├── package.json              # Project dependencies and scripts
├── postcss.config.mjs        # PostCSS configuration for Tailwind
└── tsconfig.json             # TypeScript configuration
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build the production application |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint to check code quality |

## Usage

### Home Page
The landing page provides navigation to two dashboard versions:
- **React Dashboard** (`/dashboard`): Full-featured React/Next.js dashboard
- **Static HTML** (`/dashboard.html`): Standalone HTML version

### Dashboard Features
1. **Sidebar Navigation**: Access different sections like Map View, Asset Inventory, Maintenance Logs, Fleet Tracking, and Spatial Analytics
2. **Top Navigation**: Search functionality, quick actions, and user controls
3. **KPI Cards**: At-a-glance metrics for road health monitoring
4. **Interactive Map**: 
   - Click on markers to view incident details
   - Use map controls to zoom, reset view, or change styles
   - Incidents are color-coded by severity (red=HIGH, amber=MED, green=LOW)
5. **Live Feed Panel**: Real-time stream of detected anomalies with options to view on map or assign crews

## Mapbox Integration

The application uses Mapbox GL for vector tile rendering. You can configure your access token in two ways:

1. **Environment Variable** (recommended): Set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env.local`
2. **UI Input**: Enter your token directly in the modal that appears when the map loads

The token is stored in localStorage for convenience during development.

## Deployment

### Vercel (Recommended)

Deploy easily using the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme):

1. Push your code to a Git repository
2. Import your project in Vercel
3. Add your `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` as an environment variable
4. Deploy

### Other Platforms

See the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for deployment instructions on other platforms.

## Resources

- [Next.js Documentation](https://nextjs.org/docs) - Features and API reference
- [Learn Next.js](https://nextjs.org/learn) - Interactive tutorial
- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/guides/) - Map integration guide
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - Utility-first CSS framework

## License

This project is private and proprietary.

---

*Built with Next.js and Mapbox GL for real-time infrastructure monitoring.*
