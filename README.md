# RegWatch - Privacy Regulation Monitor

A comprehensive MERN stack application for real-time global privacy regulation monitoring.

## Features

- **Interactive Globe Visualization** - 3D/2D globe showing regulation strictness and activity by region
- **Live Feed** - Real-time scrolling feed of regulatory updates with filtering
- **Regulation Library** - Comprehensive database of global privacy laws (GDPR, CCPA, LGPD, PIPL, etc.)
- **Enforcement Tracker** - Database of fines, penalties, and enforcement actions
- **AI Chat Assistant (RegBot)** - Natural language queries about regulations
- **Compliance Checklists** - Generate and track compliance requirements
- **PDF Reports** - Generate professional compliance reports
- **Alert System** - Custom notifications via email, Slack, webhooks

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, Framer Motion, react-globe.gl
- **Backend**: Node.js, Express.js, MongoDB, Redis, Socket.io
- **Scraping**: Puppeteer, Cheerio, RSS Parser, BullMQ
- **AI**: OpenAI/Anthropic API integration

## Project Structure

```
privacy-regulation-monitor/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React context providers
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API services
│   │   └── styles/         # Global styles
│   └── package.json
├── server/                 # Express Backend
│   ├── src/
│   │   ├── config/         # Database & Redis config
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Auth, rate limiting, errors
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # API routes
│   │   ├── scrapers/       # Web scraping engine
│   │   └── websocket/      # Socket.io setup
│   └── package.json
├── shared/                 # Shared types/constants
├── docker-compose.yml
└── package.json
```

## Scraping Sources

The application scrapes from 50+ sources across three tiers:

### Tier 1 - Official Sources
- EU Official Journal, EDPB
- UK ICO
- US FTC, Federal Register, HHS
- California CPPA, Attorney General
- CNIL, BfDI, AEPD, DPC Ireland
- Japan PPC, Singapore PDPC, Australia OAIC
- Brazil ANPD

### Tier 2 - Industry Sources
- IAPP, Future of Privacy Forum, EFF
- Lexology, JD Supra
- Reuters, TechCrunch
- GDPR Enforcement Tracker

### Tier 3 - Research Sources
- SSRN, arXiv
- Brookings, CDT
- PwC, Deloitte

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB
- Redis (optional, for caching and job queues)

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp server/.env.example server/.env
# Edit .env with your configuration
```

4. Start development servers:
```bash
npm run dev
```

This will start:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

### Using Docker

```bash
# Start MongoDB and Redis
npm run docker:dev

# Start the application
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Updates/Feed
- `GET /api/updates` - List updates (paginated, filterable)
- `GET /api/updates/:id` - Single update detail
- `GET /api/updates/stats/summary` - Aggregated statistics

### Regulations
- `GET /api/regulations` - List all regulations
- `GET /api/regulations/:id` - Single regulation detail
- `GET /api/regulations/compare` - Compare regulations

### Enforcements
- `GET /api/enforcements` - List enforcements
- `GET /api/enforcements/stats/summary` - Statistics
- `GET /api/enforcements/top/list` - Top fines

### AI Chat
- `POST /api/chat` - Send message, get AI response
- `GET /api/chat/history` - User's chat history

### Checklists
- `GET /api/checklists` - User's checklists
- `POST /api/checklists/generate` - AI-generate checklist
- `GET /api/checklists/templates` - Pre-built templates

### Reports
- `POST /api/reports/generate` - Generate report
- `GET /api/reports/:id/download` - Download report

## Environment Variables

```env
# Server
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/regwatch

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# AI
OPENAI_API_KEY=your-openai-key
# or
ANTHROPIC_API_KEY=your-anthropic-key
AI_PROVIDER=openai

# Email
SENDGRID_API_KEY=your-sendgrid-key

# CORS
CORS_ORIGIN=http://localhost:5173
```
One

