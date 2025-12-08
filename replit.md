# כוננות קל - WhatsApp Group Monitor (Multi-User SaaS)

## Overview

כוננות קל (Konanut Kal / Easy Standby) is a **multi-user SaaS** WhatsApp monitoring platform that allows each user to connect their own WhatsApp, track specific groups for keyword mentions, and receive real-time private WhatsApp message alerts. The application provides a bilingual web interface (Hebrew/English) for managing WhatsApp group subscriptions, defining per-group alert keywords, and viewing triggered alerts.

The system uses WhatsApp Web.js to connect to WhatsApp via QR code authentication, monitors selected groups in real-time, and **sends actual private WhatsApp messages** when keywords are matched in group conversations.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (December 2024)

### New Features Added:
1. **Bilingual i18n System** - Full Hebrew/English support with language toggle
2. **Per-Group Keywords** - Keywords can now be set per group instead of global-only
3. **WhatsApp Self-Messaging Alerts** - Sends actual WhatsApp messages to user's phone number
4. **Connection Stability Improvements** - Retry logic, better session management, timeout handling
5. **Phone Number Input** - Users can configure their phone number for receiving alerts
6. **Global Language Toggle** - Available on landing page for unauthenticated users, persists to localStorage and syncs to DB on login
7. **WhatsApp Auto-Reconnect** - Sessions persist across logins; auto-reconnect checks for existing auth data on socket authentication
8. **Dual Branding** - Hebrew "כוננות קל" and English "Whatsappdibs" across all meta tags and UI

### Connection Stability Updates:
- `autoReconnectingUsers` Set prevents duplicate initialization when socket authenticates rapidly
- `isUserInitializing()` helper function checks if WhatsApp client is mid-initialization
- Session files in `.wwebjs_auth/session-{userId}` trigger auto-reconnect on login

### Security Updates (December 2024):
- **CORS**: Strict env-driven whitelist only (REPLIT_DEV_DOMAIN, REPLIT_DOMAINS, ALLOWED_ORIGINS). No wildcard patterns.
- **Input Sanitization**: Keywords max 100 chars, max 50 per group. Group names max 200 chars. Watched groups max 100.
- **Rate Limiting**: WhatsApp initialization has 30-second cooldown per user with periodic cleanup.
- **Admin Audit Logging**: All admin access attempts logged with user ID, email, and outcome.
- **Phone Validation**: International format support (7-15 digits, handles + prefix).
- **.gitignore**: `.wwebjs_auth/` directory excluded to prevent credential exposure.
- **Health Check**: Optional database connectivity check via `?db=true` parameter.

### Schema Updates:
- Added `group_keywords` table for per-group keyword settings
- Added `language` field to `user_settings` (default: "he")
- Enhanced alert tracking with `alertSent` status

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
- Framer Motion for animations
- Mobile-first responsive design with RTL/LTR support

**i18n System:**
- Translation files at `client/src/lib/i18n.ts`
- Supports Hebrew (`he`) and English (`en`)
- Language preference persisted per user in database
- RTL/LTR direction automatically applied based on language

**Pages:**
- `/` - Landing page (unauthenticated) or Dashboard (authenticated)
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

**WhatsApp Session Manager (`server/whatsappManager.ts`):**
- Per-user isolated WhatsApp client instances
- Session data stored in `.wwebjs_auth/<userId>` directories
- LocalAuth strategy for persistent sessions
- **Connection Stability Features:**
  - Retry logic with MAX_RETRY_ATTEMPTS (3)
  - INIT_TIMEOUT (2 minutes) to prevent hanging
  - Safe client destruction on disconnect/auth_failure
  - Single-flight initialization pattern
- **Self-Messaging Alert System:**
  - Sends WhatsApp message to user's configured phone number
  - Bilingual alert message format (Hebrew + English)
  - Uses `client.sendMessage()` for reliability
  - Tracks `alertSent` status in database

**Socket.IO Multi-User Design:**
- Users must authenticate via `socket.emit("authenticate", userId)`
- Each user joins a private room `user:${userId}`
- Events are emitted only to the authenticated user's room
- Events: `connection_status`, `qr_code`, `groups`, `settings`, `group_keywords`, `alerts`, `new_alert`

**Socket Events:**
- `start_whatsapp` - Initialize WhatsApp connection
- `save_settings` - Save user settings (groups, global keywords, phone)
- `save_group_keywords` - Save per-group keywords
- `delete_group_keywords` - Remove per-group keywords
- `set_language` - Update user's language preference
- `refresh_groups` - Refresh WhatsApp groups list
- `disconnect_whatsapp` - Disconnect WhatsApp

**Storage Strategy:**
- PostgreSQL database for all persistent data
- Drizzle ORM for type-safe database operations
- Per-user data isolation via userId foreign keys
- Session storage in database (connect-pg-simple)

### Database Schema (PostgreSQL + Drizzle ORM)

**Tables:**
- `users` - User accounts (id, email, firstName, lastName, profileImageUrl, isAdmin, createdAt)
- `sessions` - Express session storage
- `user_settings` - Per-user settings (userId, watchedGroups, alertKeywords, myNumber, language, whatsappStatus)
- `group_keywords` - Per-group keyword settings (userId, groupId, groupName, keywords[])
- `alerts` - Alert history (userId, groupId, groupName, matchedKeyword, messageText, senderName, timestamp, alertSent)

**Key Relationships:**
- All tables except `users` have a `userId` foreign key
- Cascade delete on user removal

### API Endpoints

**Authentication:**
- `GET /api/login` - Initiate Replit Auth login
- `GET /api/logout` - Logout and destroy session
- `GET /api/auth/user` - Get current authenticated user

**Settings:**
- `GET /api/settings` - Get user settings
- `POST /api/settings` - Save user settings
- `POST /api/language` - Update language preference

**Group Keywords:**
- `GET /api/group-keywords` - Get all per-group keywords
- `POST /api/group-keywords` - Save keywords for a group
- `DELETE /api/group-keywords/:groupId` - Delete keywords for a group

**Alerts:**
- `GET /api/alerts` - Get user's alerts
- `DELETE /api/alerts` - Clear all alerts

**WhatsApp:**
- `GET /api/whatsapp/status` - Get connection status, QR code, groups

**Admin:**
- `GET /api/admin/users` - Get all users (admin only)

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
│   ├── lib/
│   │   └── i18n.ts          # Translation system
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

## Keyword Alert Logic

When a message is received in a monitored group:
1. Check if the group is in the user's `watchedGroups` list
2. Get per-group keywords from `group_keywords` table
3. If no per-group keywords, fall back to global `alertKeywords`
4. If message contains any keyword:
   - Send WhatsApp message to user's `myNumber` (if configured)
   - Save alert to database with `alertSent` status
   - Emit `new_alert` event to user's Socket.IO room
