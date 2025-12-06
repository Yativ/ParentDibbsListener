# כוננות קל - WhatsApp Group Monitor (Multi-User SaaS)

## Overview

כוננות קל (Easy Standby) is a **multi-user SaaS** WhatsApp monitoring platform that allows each user to connect their own WhatsApp, track specific groups for keyword mentions, and receive real-time private message alerts. The application provides a web-based interface in Hebrew for managing WhatsApp group subscriptions, defining alert keywords, and viewing triggered alerts when important messages are detected.

The system uses WhatsApp Web.js to connect to WhatsApp via QR code authentication, monitors selected groups in real-time, and sends private WhatsApp messages when keywords are matched in group conversations. The entire UI is in Hebrew with RTL (right-to-left) support.

## User Preferences

Preferred communication style: Simple, everyday language.

## Multi-User Architecture

This is a **multi-tenant SaaS application** where:
- Each user creates an account via Replit Auth (Google, GitHub, Apple, or email)
- Each user connects their own WhatsApp via individual QR code scan
- User data is completely isolated (settings, groups, keywords, alerts)
- Socket.IO uses per-user rooms for private real-time updates
- Admin users can view all user accounts and their status

### Authentication
- **Provider:** Replit Auth (OIDC)
- **Login Methods:** Google/Gmail, GitHub, Apple, Email/Password
- **Session:** PostgreSQL-backed express-session
- **Routes:** `/api/login`, `/api/logout`, `/api/auth/user`

### Admin Features
- Admin dashboard at `/admin` route
- View all registered users
- Monitor WhatsApp connection status per user
- Toggle admin privileges (requires direct DB update)

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

**Pages:**
- `/` - Landing page with marketing content and login CTA
- `/dashboard` - Main app (requires auth) - WhatsApp connection, groups, keywords, alerts
- `/admin` - Admin panel (requires auth + isAdmin) - User management

**State Management Strategy:**
- React Query handles server state with infinite stale time by default
- Socket.IO manages real-time connection state and events
- Local React state (useState) for UI interactions
- useAuth hook provides authentication state

### Backend Architecture

**Technology Stack:**
- Node.js with Express.js server
- TypeScript throughout the backend
- PostgreSQL with Drizzle ORM
- Socket.IO for WebSocket real-time communication
- WhatsApp Web.js for WhatsApp integration

**Server Structure:**
- Express middleware handles JSON parsing and session management
- HTTP server wraps Express to enable Socket.IO integration
- Separate routing and static file serving modules
- Development mode includes Vite middleware for HMR

**Fast Startup Architecture (for VM deployment):**
- Health check endpoint `/api/health` registered synchronously BEFORE httpServer.listen()
- In production: static files served synchronously before listening
- In development: temporary loading page shown until Vite is ready
- Server starts listening IMMEDIATELY on port 5000
- Async setup happens AFTER server is already listening
- This ensures deployment health checks pass instantly

**WhatsApp Session Manager:**
- `WhatsAppSessionManager` class manages multiple isolated sessions
- Each user gets their own WhatsApp client instance
- Session data stored in `.wwebjs_auth/<userId>` directories
- LocalAuth strategy for persistent sessions per user
- Automatic client cleanup on disconnect

**Socket.IO Multi-User Design:**
- Users must authenticate via `socket.emit("authenticate", userId)`
- Each user joins a private room `user:${userId}`
- Events are emitted only to the authenticated user's room
- Events: `connection_status`, `qr_code`, `groups`, `settings`, `alerts`, `new_alert`

**Storage Strategy:**
- PostgreSQL database for all persistent data
- Drizzle ORM for type-safe database operations
- Per-user data isolation via userId foreign keys
- Session storage in database (connect-pg-simple)

### Database Schema (PostgreSQL + Drizzle ORM)

**Tables:**
- `users` - User accounts (id, email, firstName, lastName, profileImageUrl, isAdmin, createdAt)
- `sessions` - Express session storage
- `user_settings` - Per-user settings (userId, watchedGroups, alertKeywords)
- `alerts` - Alert history (userId, groupId, groupName, matchedKeyword, messageText, senderName, timestamp, alertSent)

**Key Relationships:**
- All tables except `users` have a `userId` foreign key
- Cascade delete on user removal

### Build and Deployment

**Build Process:**
- Custom build script (script/build.ts) using esbuild and Vite
- Client built with Vite to dist/public
- Server bundled with esbuild to dist/index.cjs
- Selective dependency bundling to reduce syscalls and improve cold starts

**Deployment Configuration:**
- **Deployment Target:** VM (required for WhatsApp Web.js / Puppeteer)
- VM provides persistent filesystem for session storage
- Cannot use autoscale (stateful WhatsApp sessions require persistence)

**Development vs Production:**
- Development: Vite dev server with HMR, middleware mode integration
- Production: Pre-built static assets served by Express
- Environment detection via NODE_ENV

## External Dependencies

### Database
- **Provider:** PostgreSQL (Neon serverless via @neondatabase/serverless)
- **ORM:** Drizzle ORM with drizzle-zod for validation
- **Session Store:** connect-pg-simple

### Authentication
- **Provider:** Replit Auth (OIDC)
- **Library:** openid-client
- **Session:** express-session with PostgreSQL backend

### WhatsApp Integration
- **Library:** whatsapp-web.js
- **Authentication:** QR code scan via WhatsApp mobile app
- **Session Management:** LocalAuth strategy with per-user directories
- **Browser Automation:** Puppeteer with Chromium
- **Requirements:** Chromium binary (installed via Nix packages)

### Real-time Communication
- **Library:** Socket.IO (server and client)
- **Transport:** WebSocket with fallback to HTTP long-polling
- **Architecture:** Per-user rooms for isolated event delivery

### UI Component Library
- **Framework:** Radix UI primitives via Shadcn/ui
- **Components:** 40+ accessible, unstyled component primitives
- **Customization:** Tailwind CSS with design tokens
- **Icons:** Lucide React

### Build Tools
- **Frontend Bundler:** Vite with React plugin
- **Backend Bundler:** esbuild
- **TypeScript Compiler:** tsc for type checking

## File Structure

```
├── client/src/
│   ├── App.tsx              # Router and providers
│   ├── pages/
│   │   ├── landing.tsx      # Public landing page
│   │   ├── dashboard.tsx    # Main app (authenticated)
│   │   ├── admin.tsx        # Admin panel
│   │   └── not-found.tsx    # 404 page
│   ├── hooks/
│   │   └── useAuth.ts       # Authentication hook
│   └── components/ui/       # Shadcn components
├── server/
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # API routes + Socket.IO
│   ├── replitAuth.ts        # Replit Auth setup
│   ├── storage.ts           # Database operations
│   ├── whatsappManager.ts   # Multi-user WhatsApp sessions
│   └── db.ts                # Drizzle database connection
├── shared/
│   └── schema.ts            # Database schema + types
└── .replit                  # Deployment config (VM target)
```

## Admin Operations

To make a user an admin, update the database directly:
```sql
UPDATE users SET is_admin = true WHERE email = 'admin@example.com';
```

The first user to sign up should be designated as admin for initial setup.
