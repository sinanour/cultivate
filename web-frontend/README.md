# Web Frontend Package

Progressive Web Application (PWA) built with React 18+, TypeScript, and Vite that provides community organizers with a responsive interface for managing activities, participants, and viewing analytics.

## Technology Stack

- **React 18+** with TypeScript
- **Vite** for fast development and optimized builds
- **AWS CloudScape Design System** for UI components
- **React Query** (TanStack Query) for server state management
- **Dexie.js** for IndexedDB offline storage
- **Leaflet** for interactive maps
- **Recharts** for data visualization
- **Vitest** and React Testing Library for testing
- **fast-check** for property-based testing

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Build

```bash
npm run build
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Generic components
│   ├── layout/         # Layout components
│   └── features/       # Feature-specific components
├── pages/              # Route-level page components
├── hooks/              # Custom React hooks
├── services/           # API client and business logic
│   ├── api/           # Backend API integration
│   ├── offline/       # Offline storage and sync
│   └── auth/          # Authentication service
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── contexts/           # React contexts
└── __tests__/         # Test files
```

## Features

- Responsive web interface (768px to 1920px)
- Offline support with IndexedDB
- Progressive Web App capabilities
- Role-based access control
- Interactive map visualization
- Analytics dashboards
- Real-time data synchronization

## License

Private - Community Activity Tracker Project
