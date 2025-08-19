# Late Fine Tracker

A gamified fine tracking application for late arrivals. Perfect for friend groups, work teams, or any social gathering where punctuality matters!

## Features

- 🎮 **Gamified Experience**: Track late arrivals with fines, streaks, and leaderboards
- 💰 **Customizable Fines**: Set your own currency and fine amounts
- 📊 **Visual Analytics**: Charts and statistics to see who's contributing most
- 🏆 **Leaderboards**: Rank players by contributions and track on-time streaks
- 📱 **Responsive Design**: Works perfectly on mobile and desktop
- 💾 **Local Storage**: All data is stored locally in your browser

## Quick Start

### Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Open [http://localhost:5173](http://localhost:5173)

### Building for Production

```bash
npm run build
npm run preview
```

## Deployment

### Netlify (Recommended)

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy!

### Vercel

```bash
npm install -g vercel
vercel
```

### GitHub Pages

1. Build the project: `npm run build`
2. Deploy the `dist` folder to GitHub Pages

## How to Use

1. **Add Players**: Start by adding all participants to the game
2. **Mark Late Arrivals**: When someone is late, tap their name to add a fine
3. **Customize Settings**: Adjust currency, fine amounts, and other settings
4. **Track Progress**: View leaderboards, charts, and statistics
5. **New Season**: Reset data when starting fresh

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **Framer Motion** - Animations
- **Recharts** - Data visualization
- **Lucide React** - Icons

## Architecture

This is a single-page React application with:
- Local state management using React hooks
- LocalStorage persistence
- Responsive design with Tailwind CSS
- Modern UI components from shadcn/ui
- Smooth animations with Framer Motion

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - feel free to use this for your own projects!