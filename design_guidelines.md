# ParentDibbs WhatsApp Listener - Design Guidelines

## Design Approach
**System-Based Approach: Material Design 3 (Fluent-inspired)**
This monitoring dashboard prioritizes clarity, quick scanning, and mobile accessibility. Drawing from modern dashboard patterns (Linear, Notion, Vercel), we focus on information hierarchy and functional efficiency.

## Typography System
**Font Family:** Inter via Google Fonts CDN
- **Header (H1):** 2xl (24px), font-semibold - Dashboard title
- **Section Headers (H2):** lg (18px), font-medium - Status, Groups, Keywords, Alerts
- **Body Text:** base (16px), font-normal - Group names, settings
- **Labels/Meta:** sm (14px), font-medium - Status labels, timestamps
- **Alerts:** xl (20px), font-bold - Alert messages

## Layout System
**Spacing Units:** Tailwind utilities: 2, 3, 4, 6, 8, 12, 16
- Consistent padding: p-4 for cards, p-6 for main container
- Vertical rhythm: space-y-6 between major sections
- Form spacing: space-y-3 for inputs and checkboxes

**Container Structure:**
- Single column mobile-first layout (max-w-3xl mx-auto)
- Full-width on mobile, centered with padding on desktop
- Each functional section in distinct card containers

## Component Library

### Status Indicator (Top Priority)
- Large, prominent status badge at top of dashboard
- 🟢 CONNECTED: Success state with timestamp
- 🔴 DISCONNECTED: Warning state with "Scan QR" prompt
- Full-width alert-style banner with icon and text

### QR Code Display
- Center-aligned container with max-w-sm
- White background card with generous padding (p-8)
- QR code displayed as monospace text or generated image
- Helper text below: "Scan with WhatsApp to connect"

### Group Selection Section
- Card container with scrollable list (max-h-96 overflow-y-auto)
- Checkbox list items with consistent spacing (py-3)
- Each row: checkbox, group name, optional message count
- "Select All" / "Deselect All" utility buttons at top

### Keyword Input Section
- Labeled text input field (full width)
- Placeholder: "alert, urgent, important (comma-separated)"
- Helper text below: "Messages matching these keywords will trigger alerts"
- Character count indicator for long keyword lists

### Save Settings Button
- Prominent primary button (full width on mobile, auto on desktop)
- Fixed position on mobile for easy access (bottom sticky)
- Loading state indicator when saving

### Recent Alerts Log
- Reverse chronological list of alert cards
- Each alert card contains:
  - Timestamp (top-right, small text)
  - Group name (bold, medium text)
  - Matched keyword (badge/chip style)
  - Message preview (truncated with "Read more")
- Max height with scroll (max-h-96)
- Empty state: "No alerts yet" with icon

## Interaction Patterns

### Form Interactions
- Checkbox hover: subtle background change
- Input focus: border highlight with ring effect
- Button states: subtle scale on tap, disabled opacity

### Real-time Updates
- Smooth fade-in for new alerts (opacity transition)
- Status indicator pulse animation when connecting
- Toast notifications for settings saved confirmation

## Mobile Optimization
- Touch-friendly tap targets (min 44px height)
- Bottom-sticky save button for thumb reach
- Collapsible sections with accordion pattern for groups list
- Swipe-friendly alert cards

## Accessibility
- Clear focus indicators on all interactive elements
- Semantic HTML structure (sections, labels, buttons)
- ARIA labels for status indicators and icon buttons
- Keyboard navigation support for all controls

## Key Design Principles
1. **Clarity First:** Information hierarchy ensures critical status is immediately visible
2. **Quick Access:** Mobile-optimized for checking alerts on-the-go
3. **Minimal Friction:** Settings changes require minimal taps/clicks
4. **Persistent Context:** Status always visible, settings always accessible