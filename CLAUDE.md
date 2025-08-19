# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Late Fine Tracker is a single-file React application for gamifying tardiness with a fine-based system. The entire application is contained in `late_fine_tracker_react_single_file_app.jsx` - a standalone React component designed to be embedded in larger projects.

## Architecture

**Single-File React Application**
- **Framework**: React with hooks (useState, useEffect, useMemo)
- **UI Components**: Uses shadcn/ui component library (@/components/ui/*)
- **Animation**: Framer Motion for smooth transitions
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React icons
- **Styling**: Tailwind CSS classes
- **Storage**: LocalStorage persistence with key `late-fine-tracker:v1`

**Core Data Model**
- Players: `{id, name}`
- Events: `{id, playerId, dateISO, reason, amount}`
- Settings: `{fineAmount, currency, season}`

**Key Features**
- Player management (add/remove players)
- Quick late marking with customizable reasons and amounts
- Leaderboard with contribution tracking
- Streak calculation (days since last late)
- Season management and data persistence
- Visual charts and statistics

## Development Approach

**No Build System Required**
- This is a standalone JSX file meant to be imported into existing React projects
- No package.json, no build scripts, no dependencies to install
- Assumes the importing project already has React, Framer Motion, Recharts, and shadcn/ui components

**Component Dependencies**
The app imports these shadcn/ui components:
- Button, Card (CardContent, CardHeader, CardTitle)
- Input, Tabs (TabsList, TabsTrigger, TabsContent)
- Badge, Dialog (DialogContent, DialogHeader, DialogTitle, DialogTrigger)
- Label

**Testing the Component**
To test changes:
1. Copy the component into a React project with the required dependencies
2. Import and render the component: `<LateFineTracker />`
3. Test functionality in the browser

**Data Persistence**
- All data is stored in localStorage under key `late-fine-tracker:v1`
- Data structure: `{players, events, fineAmount, currency, season}`
- Changes are automatically persisted on state updates

## Code Structure

**State Management** (lines 24-30)
- Uses React hooks for local state
- Derived data computed with useMemo for performance

**Key Functions**
- `addPlayer()` - Add new player to the game
- `markLate(playerId)` - Record a late event for a player
- `resetSeason()` - Clear events and increment season number
- `seedDemo()` - Add sample data for testing

**UI Sections**
- Header with settings dialog and season controls
- Summary cards showing total pool, top contributor, player count
- Three tabs: Play (mark late), Leaderboard (rankings), Events (history)

## Gamification Elements

- **Streak tracking**: Days since last late arrival
- **Leaderboard**: Ranked by total contributions
- **Visual feedback**: Charts and animated buttons
- **Seasons**: Ability to reset and start fresh
- **Customizable fines**: Adjustable amounts and currency