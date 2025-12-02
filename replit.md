# כוננות קל - WhatsApp Group Monitor

## Overview

כוננות קל (Easy Standby) is a WhatsApp monitoring dashboard that allows users to track specific groups for keyword mentions and receive real-time private message alerts. The application provides a web-based interface in Hebrew for managing WhatsApp group subscriptions, defining alert keywords, and viewing triggered alerts when important messages are detected.

The system uses WhatsApp Web.js to connect to WhatsApp via QR code authentication, monitors selected groups in real-time, and sends private WhatsApp messages when keywords are matched in group conversations. The entire UI is in Hebrew with RTL (right-to-left) support.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management
- Socket.IO client for real-time WebSocket communication

**UI Framework:**
- Shadcn/ui component library with Radix UI primitives
- Tailwind CSS for styling with custom design system
- Material Design 3 inspired approach (per design guidelines)
- Inter font family from Google Fonts
- Mobile-first responsive design

**State Management Strategy:**
- React Query handles server state with infinite stale time by default
- Socket.IO manages real-time connection state and events
- Local React state (useState) for UI interactions
- No global state management library (Redux/Zustand) - keeps complexity minimal

**Design Decisions:**
- Single-page application with dashboard as the primary view
- Real-time updates via WebSocket connections for connection status, groups, and alerts
- Component-based architecture with reusable Shadcn UI components
- TypeScript path aliases (@/, @shared/) for clean imports

### Backend Architecture

**Technology Stack:**
- Node.js with Express.js server
- TypeScript throughout the backend
- Socket.IO for WebSocket real-time communication
- WhatsApp Web.js for WhatsApp integration
- File-based storage for settings (settings.json)

**Server Structure:**
- Express middleware handles JSON parsing and raw body access (for webhook compatibility)
- HTTP server wraps Express to enable Socket.IO integration
- Separate routing and static file serving modules
- Development mode includes Vite middleware for HMR

**WhatsApp Integration Design:**
- WhatsApp Web.js client with LocalAuth strategy for persistent sessions
- Puppeteer runs headless Chromium for WhatsApp Web automation
- QR code generation via qrcode library for authentication
- Session data stored in .wwebjs_auth directory
- Client lifecycle management through Socket.IO events

**Real-time Communication:**
- Socket.IO handles bidirectional events between client and server
- Events: connection status updates, QR code delivery, group list sync, alert notifications
- Server emits events on WhatsApp client state changes
- Client requests trigger server actions (save settings, fetch groups)

**Storage Strategy:**
- File-based JSON storage for user settings (watched groups, keywords, phone number)
- In-memory storage for alerts with MAX_ALERTS limit (100)
- No database currently used - designed for simple single-user deployment
- Settings persist across restarts via settings.json file

**Message Monitoring Logic:**
- Listens to WhatsApp 'message_create' events
- Filters messages to only process group messages
- Checks if message is from a watched group
- Performs case-insensitive keyword matching
- Sends private WhatsApp message to user when match found
- Stores alert metadata in memory

### Build and Deployment

**Build Process:**
- Custom build script (script/build.ts) using esbuild and Vite
- Client built with Vite to dist/public
- Server bundled with esbuild to dist/index.cjs
- Selective dependency bundling (allowlist) to reduce syscalls and improve cold starts
- Production mode serves static files from dist/public

**Development vs Production:**
- Development: Vite dev server with HMR, middleware mode integration
- Development: Replit-specific plugins (cartographer, dev-banner, runtime-error-modal)
- Production: Pre-built static assets served by Express
- Environment detection via NODE_ENV

### Data Schema

**Type Definitions (shared/schema.ts):**
- Zod schemas define runtime validation and TypeScript types
- WhatsAppGroup: id, name, isGroup flag
- Settings: watched group IDs array, alert keywords array, user phone number
- Alert: id, group info, matched keyword, message details, sender, timestamp, alert sent status
- ConnectionStatus: enum of disconnected, connecting, qr_ready, connected

**Shared Types:**
- Schema definitions shared between client and server via @shared path alias
- Ensures type safety across the full stack
- Zod provides both validation and type inference

### Third-Party Integration Points

**WhatsApp Web.js:**
- Requires Chromium binary (dynamically detected via CHROMIUM_PATH env var or system lookup)
- Uses LocalAuth for session persistence
- Puppeteer args configured for headless operation in containerized environments
- No official API - uses WhatsApp Web reverse engineering
- Chromium path detection checks: environment variable, then common paths (chromium, chromium-browser, google-chrome)

**Design System:**
- Material Design 3 principles applied through custom Tailwind configuration
- New York style variant of Shadcn/ui components
- Custom CSS variables for theming (light mode defined, dark mode structure present)

## External Dependencies

### Database
- **Current:** File-based JSON storage (settings.json)
- **Future Consideration:** PostgreSQL with Drizzle ORM (configuration present in drizzle.config.ts)
- **Database Provider:** Neon serverless Postgres (@neondatabase/serverless package installed)
- **Schema Location:** shared/schema.ts (currently only Zod schemas, no Drizzle tables defined yet)

### WhatsApp Integration
- **Library:** whatsapp-web.js
- **Authentication:** QR code scan via WhatsApp mobile app
- **Session Management:** LocalAuth strategy with persistent file storage
- **Browser Automation:** Puppeteer with Chromium
- **Limitations:** Unofficial library, subject to WhatsApp Web changes

### Real-time Communication
- **Library:** Socket.IO (server and client)
- **Transport:** WebSocket with fallback to HTTP long-polling
- **Events:** Custom event-driven architecture for connection state, groups, and alerts

### UI Component Library
- **Framework:** Radix UI primitives via Shadcn/ui
- **Components:** 40+ accessible, unstyled component primitives
- **Customization:** Tailwind CSS with design tokens defined in CSS variables
- **Icons:** Lucide React

### Styling and Design
- **CSS Framework:** Tailwind CSS with PostCSS
- **Font Loading:** Google Fonts CDN (Inter font family)
- **Design System:** Custom tokens extending Shadcn defaults
- **Responsive:** Mobile-first breakpoints

### Build Tools
- **Frontend Bundler:** Vite with React plugin
- **Backend Bundler:** esbuild
- **TypeScript Compiler:** tsc for type checking (noEmit mode)
- **Development:** Replit-specific Vite plugins for enhanced DX

### Other Integrations
- **QR Code Generation:** qrcode library for WhatsApp authentication codes
- **Date Formatting:** date-fns for timestamp display
- **Validation:** Zod for runtime schema validation
- **Form Handling:** React Hook Form with Zod resolver