# Allen GTD — React Native App

**A Getting Things Done (GTD) productivity app for iOS and Android**

Built with React Native, TypeScript, and WatermelonDB for offline-first task management.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Development Workflow](#development-workflow)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Troubleshooting](#troubleshooting)
- [Development Roadmap](#development-roadmap)

---

## Overview

**Allen** is a mobile GTD (Getting Things Done) app that implements David Allen's productivity methodology. The app helps users:

- Capture everything into an Inbox
- Process items through a guided workflow
- Organize tasks into actionable categories
- Work offline-first with automatic sync

**Current Status:** Phase 1 (Week 1) — Foundation complete
- ✅ Database setup (WatermelonDB)
- ✅ Navigation (6 tabs)
- ✅ Inbox screen (add, delete, list)
- ⏳ GTD workflow dialog (Task 1.7 — next up)

---

## Tech Stack

### Frontend
- **React Native** 0.73.0 — Cross-platform mobile framework
- **TypeScript** 5.0.4 — Type safety
- **React Navigation** 6.x — Tab and stack navigation

### Data & State
- **WatermelonDB** 0.27.1 — Offline-first SQLite database
- **RxJS** 7.8.1 — Reactive observables for real-time UI updates
- **AsyncStorage** — Simple key-value storage for config

### Utilities
- **React Native Keychain** — Secure auth token storage
- **NetInfo** — Network status detection for sync

### Development
- **Babel** — Transpiler with decorators support for WatermelonDB
- **ESLint** — Code linting
- **Prettier** — Code formatting

---

## Project Structure

```
AllenGTD/
├── App.tsx                          # Root component
├── index.js                         # Entry point
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config (strict mode)
├── babel.config.js                  # Babel with decorators + path aliases
│
├── ios/                             # Native iOS code (Xcode project)
│   ├── Podfile                      # CocoaPods dependencies
│   └── AllenGTD.xcworkspace         # Xcode workspace
│
├── android/                         # Native Android code (Gradle project)
│
└── src/
    ├── types/
    │   └── index.ts                 # Global TypeScript types
    │                                # (GTDCategory, Item, WorkflowStep, etc.)
    │
    ├── navigation/
    │   └── TabNavigator.tsx         # Bottom tab navigation (6 tabs)
    │
    ├── screens/
    │   ├── Inbox/
    │   │   └── InboxScreen.tsx      # ✅ Fully implemented
    │   ├── NextActions/             # ⏳ Coming in Task 2.1
    │   ├── Projects/                # ⏳ Coming in Task 2.2
    │   ├── Waiting/                 # ⏳ Coming in Task 2.3
    │   ├── Someday/                 # ⏳ Coming in Task 2.4
    │   └── Reference/               # ⏳ Coming in Task 2.5
    │
    ├── components/
    │   ├── common/                  # Reusable UI components
    │   ├── inbox/                   # Inbox-specific components
    │   └── workflow/                # GTD workflow dialog components
    │
    ├── hooks/
    │   └── useItems.ts              # Custom hooks for database operations
    │                                # - useInboxItems()
    │                                # - useItemActions()
    │
    ├── services/
    │   ├── database/
    │   │   ├── index.ts             # WatermelonDB setup
    │   │   ├── schema.ts            # Database schema
    │   │   ├── models/
    │   │   │   ├── Item.ts          # WatermelonDB Item model
    │   │   │   └── ProjectStep.ts   # WatermelonDB ProjectStep model
    │   │   └── repositories/
    │   │       └── ItemRepository.ts # All DB operations (CRUD + queries)
    │   │
    │   ├── gtd/                     # ⏳ GTD workflow logic (Task 1.7+)
    │   ├── sync/                    # ⏳ Sync engine (Week 4)
    │   └── calendar/                # ⏳ Calendar integration (Week 5)
    │
    └── utils/                       # Helper functions
```

---

## Setup Instructions

### Prerequisites

Ensure you have:
- **Node.js** 18+ — [Download](https://nodejs.org)
- **npm** or **yarn**
- **Xcode** (macOS only) — For iOS development
- **CocoaPods** — `sudo gem install cocoapods`
- **Android Studio** (optional) — For Android development
- **Watchman** (optional but recommended) — `brew install watchman`

---

### Option 1: Automated Setup (Recommended)

Download the two files from Claude and run:

```bash
# 1. Make the script executable
chmod +x install-allen.sh

# 2. Run the installer
./install-allen.sh

# 3. When prompted, copy source files from AllenGTD.zip:
unzip AllenGTD.zip
cd AllenGTD  # (the one created by the script)
cp -r ~/Downloads/AllenGTD/src/* ./src/
cp ~/Downloads/AllenGTD/App.tsx ./
cp ~/Downloads/AllenGTD/babel.config.js ./
cp ~/Downloads/AllenGTD/tsconfig.json ./

# 4. Launch
npm start          # Terminal 1
npm run ios        # Terminal 2
```

---

### Option 2: Manual Setup

```bash
# 1. Scaffold React Native project
npx react-native@latest init AllenGTD --template react-native-template-typescript
cd AllenGTD

# 2. Extract source code
unzip AllenGTD.zip
cp -r AllenGTD/src/* ./src/
cp AllenGTD/App.tsx ./
cp AllenGTD/babel.config.js ./
cp AllenGTD/tsconfig.json ./
cp AllenGTD/package.json ./

# 3. Install dependencies
npm install
npm install \
  @react-navigation/native \
  @react-navigation/bottom-tabs \
  react-native-screens \
  react-native-safe-area-context \
  @nozbe/watermelondb \
  @nozbe/with-observables \
  react-native-keychain \
  @react-native-async-storage/async-storage \
  @react-native-community/netinfo \
  rxjs

npm install --save-dev \
  @babel/plugin-proposal-decorators \
  babel-plugin-module-resolver

# 4. Install iOS native modules
cd ios
pod install
cd ..

# 5. Launch
npm start          # Terminal 1
npm run ios        # Terminal 2 (or: npm run android)
```

---

## Development Workflow

### Daily Development

```bash
# Terminal 1: Metro bundler (keep running)
npm start

# Terminal 2: Launch app
npm run ios              # iOS simulator
npm run android          # Android emulator

# Clear cache if needed
npm start -- --reset-cache
```

### Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Fix linting issues
npm run lint -- --fix

# Format code
npx prettier --write "src/**/*.{ts,tsx}"
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

---

## Architecture

### Data Flow

```
User Action (tap button)
    │
    ▼
┌──────────────────┐
│  UI Component    │  (InboxScreen.tsx)
│  (React)         │
└────────┬─────────┘
         │ Calls hook
         ▼
┌──────────────────┐
│  Custom Hook     │  (useItemActions)
│  (Business logic │
│   orchestration) │
└────────┬─────────┘
         │ Calls repository
         ▼
┌──────────────────┐
│  Repository      │  (ItemRepository)
│  (Data access)   │
└────────┬─────────┘
         │ database.write()
         ▼
┌──────────────────┐
│  WatermelonDB    │  (SQLite)
│  (Persistence)   │
└────────┬─────────┘
         │ Observable fires
         ▼
┌──────────────────┐
│  UI Auto-Updates │  (React re-renders)
└──────────────────┘
```

### Where Business Logic Lives

| Layer | Responsibility | Files |
|-------|---------------|-------|
| **UI** | Display, user input | `src/screens/**/*.tsx` |
| **Hooks** | Orchestration, loading states | `src/hooks/*.ts` |
| **Services** | Business rules, GTD workflow | `src/services/**/*.ts` |
| **Repositories** | Database queries, CRUD | `src/services/database/repositories/*.ts` |
| **Models** | Data structure, validation | `src/services/database/models/*.ts` |

**Rule:** UI components should NOT contain business logic. They call hooks, which call services.

---

## Key Features

### Current (Phase 1 — Week 1)

✅ **Inbox Management**
- Add items via quick-add input
- Delete items with confirmation
- Real-time list updates (WatermelonDB observables)
- Offline-first persistence

✅ **Navigation**
- 6-tab bottom navigation
- Tab icons and labels
- Active tab highlighting

✅ **Database**
- SQLite via WatermelonDB
- Reactive queries (observables)
- Models: Item, ProjectStep
- Repository pattern for data access

✅ **TypeScript**
- Strict mode enabled
- Path aliases (@screens, @services, etc.)
- Full type coverage

---

### Coming Soon

⏳ **GTD Workflow Dialog** (Task 1.7-1.10 — this week)
- "What is it?" decision tree
- Move to categories: Reference, Someday, Trash
- "Is it actionable?" flow
- Project creation with steps

⏳ **Multi-Category Views** (Week 2)
- Next Actions screen
- Projects with expandable steps
- Waiting For tracking
- Someday/Maybe list
- Reference with clickable links

⏳ **Backend + Sync** (Week 3-4)
- Node.js REST API
- JWT authentication
- Offline queue
- Conflict resolution

⏳ **Calendar Integration** (Week 5)
- Add to iOS/Android calendar
- "Add + Calendar" workflow option
- Calendar indicator on items

⏳ **Push Notifications** (Week 6)
- Firebase Cloud Messaging
- Reminders for due items
- Local notifications

---

## Troubleshooting

### App doesn't launch

**Symptom:** iOS simulator shows home screen, app doesn't open

**Fix:**
```bash
# 1. Check Metro is running in Terminal 1
npm start

# 2. Clear caches
npm start -- --reset-cache

# 3. Rebuild iOS
cd ios
xcodebuild clean -workspace AllenGTD.xcworkspace -scheme AllenGTD
cd ..
npm run ios
```

---

### "Native module cannot be null"

**Symptom:** Error about native modules not linking

**Fix:**
```bash
# Reinstall iOS pods
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..

# Reinstall node_modules
rm -rf node_modules
npm install

# Rebuild
npm run ios
```

---

### Path aliases not working

**Symptom:** `Cannot find module '@screens/...'`

**Fix:**
Ensure `babel.config.js` has:
```javascript
plugins: [
  ['@babel/plugin-proposal-decorators', {legacy: true}],
  ['module-resolver', {
    alias: {
      '@screens': './src/screens',
      '@services': './src/services',
      // ... etc
    }
  }]
]
```

Then restart Metro with cache clear:
```bash
npm start -- --reset-cache
```

---

### Decorators not supported

**Symptom:** `Support for the experimental syntax 'decorators' isn't currently enabled`

**Fix:**
```bash
npm install --save-dev @babel/plugin-proposal-decorators
npm start -- --reset-cache
```

---

## Development Roadmap

**8-Week Plan to Production**

- ✅ **Week 1:** Foundation + Inbox (CURRENT)
- ⏳ **Week 2:** Multi-category views + direct-add
- ⏳ **Week 3:** Backend API (Node.js + PostgreSQL)
- ⏳ **Week 4:** Sync engine (offline-first)
- ⏳ **Week 5:** Calendar integration
- ⏳ **Week 6:** Push notifications
- ⏳ **Week 7:** Polish + testing
- ⏳ **Week 8:** Deployment (App Store + Play Store)

**Next Tasks:**
1. Task 1.7: GTD workflow dialog structure
2. Task 1.8: "What is it?" step
3. Task 1.9: "Is actionable?" flow
4. Task 1.10: Project creation

---

## Contributing

This is a solo developer project following a structured 8-week build plan.

**Code Style:**
- TypeScript strict mode
- ESLint + Prettier enforced
- No business logic in UI components
- Repository pattern for data access

**Commit Messages:**
```
Task X.Y: Brief description

- Detailed change 1
- Detailed change 2
```

---

## License

Private project — not yet licensed for public use.

---

## Contact

Built by: [Your Name]
Started: [Date]
Status: Phase 1 (Week 1)

---

**Last Updated:** March 24, 2026
