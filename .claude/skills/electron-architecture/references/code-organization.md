# Code Organization Patterns

## Recommended Directory Structure

```
electron-app/
├── src/
│   ├── main/                    # Main process code
│   │   ├── index.ts            # Entry point
│   │   ├── window.ts           # Window management
│   │   ├── ipc/                # IPC handlers
│   │   │   ├── index.ts        # Handler registration
│   │   │   ├── user-handlers.ts
│   │   │   ├── file-handlers.ts
│   │   │   └── app-handlers.ts
│   │   ├── services/           # Business logic
│   │   │   ├── database.ts
│   │   │   ├── auth.ts
│   │   │   └── file-system.ts
│   │   ├── utils/              # Utilities
│   │   └── types/              # TypeScript types
│   │
│   ├── renderer/               # Renderer process code
│   │   ├── index.html          # HTML entry
│   │   ├── index.tsx           # React/Vue entry
│   │   ├── App.tsx             # Root component
│   │   ├── components/         # UI components
│   │   │   ├── common/         # Shared components
│   │   │   ├── features/       # Feature-specific components
│   │   │   └── layouts/        # Layout components
│   │   ├── pages/              # Page components
│   │   ├── hooks/              # Custom hooks (React)
│   │   ├── store/              # State management
│   │   │   ├── index.ts
│   │   │   ├── slices/         # Redux slices / Zustand stores
│   │   │   └── types.ts
│   │   ├── services/           # API/IPC services
│   │   │   ├── api.ts          # Main API client
│   │   │   └── user-service.ts
│   │   ├── utils/              # Utilities
│   │   └── types/              # TypeScript types
│   │
│   ├── preload/                # Preload scripts
│   │   ├── index.ts            # Main preload
│   │   ├── api.ts              # API definitions
│   │   └── types.ts            # Type definitions
│   │
│   └── shared/                 # Shared between processes
│       ├── types/              # Shared types
│       ├── constants.ts        # Constants
│       └── validation/         # Shared validation
│
├── resources/                  # App resources
│   ├── icons/
│   └── assets/
│
├── dist/                       # Build output
├── release/                    # Release builds
│
├── tests/                      # Tests
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── electron-builder.yml        # Builder config
├── package.json
├── tsconfig.json
└── tsconfig.*.json             # Process-specific configs
```

## Module Organization Patterns

### Pattern 1: Feature-Based Organization

Group by feature/domain rather than technical role:

```
src/renderer/features/
├── user-profile/
│   ├── components/
│   │   ├── ProfileView.tsx
│   │   ├── ProfileEdit.tsx
│   │   └── Avatar.tsx
│   ├── hooks/
│   │   └── useProfile.ts
│   ├── store/
│   │   └── profileSlice.ts
│   └── types.ts
│
└── dashboard/
    ├── components/
    ├── hooks/
    └── store/
```

**Benefits**:
- Related code stays together
- Easier to find and modify features
- Better encapsulation
- Facilitates code splitting

### Pattern 2: Service Layer

Centralize external communication:

**Main Process Services (main/services/database.ts)**:
```typescript
export class DatabaseService {
  private db: Database;

  async getUser(id: string): Promise<User> {
    // Database logic
  }

  async createUser(data: CreateUserData): Promise<User> {
    // Database logic
  }
}

// Export singleton or use DI
export const databaseService = new DatabaseService();
```

**Renderer Process Services (renderer/services/user-service.ts)**:
```typescript
export class UserService {
  async getUser(id: string): Promise<User> {
    return window.api.getUser(id);
  }

  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    return window.api.updateUser(id, data);
  }
}

export const userService = new UserService();
```

### Pattern 3: Repository Pattern

Separate data access from business logic:

**Main Process (main/repositories/user-repository.ts)**:
```typescript
export class UserRepository {
  async findById(id: string): Promise<User | null> {
    // Data access logic
  }

  async save(user: User): Promise<void> {
    // Data persistence logic
  }
}
```

**Main Process (main/services/user-service.ts)**:
```typescript
export class UserService {
  constructor(private userRepo: UserRepository) {}

  async getUser(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new Error('User not found');

    // Apply business logic
    return this.enrichUserData(user);
  }
}
```

## Dependency Management

### Pattern: Dependency Injection

**Container (main/di-container.ts)**:
```typescript
export class Container {
  private services = new Map();

  register<T>(key: string, factory: () => T): void {
    this.services.set(key, factory);
  }

  resolve<T>(key: string): T {
    const factory = this.services.get(key);
    if (!factory) throw new Error(`Service ${key} not found`);
    return factory();
  }
}

// Setup
export const container = new Container();
container.register('database', () => new DatabaseService());
container.register('userRepo', () => new UserRepository(
  container.resolve('database')
));
```

### Pattern: Module Boundaries

Define clear interfaces between modules:

**Interface (main/interfaces/storage.ts)**:
```typescript
export interface IStorageService {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}
```

**Implementation (main/services/file-storage.ts)**:
```typescript
export class FileStorageService implements IStorageService {
  // Implementation
}
```

**Alternative Implementation (main/services/db-storage.ts)**:
```typescript
export class DbStorageService implements IStorageService {
  // Implementation
}
```

## TypeScript Configuration

### Root tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/shared/*": ["src/shared/*"],
      "@/main/*": ["src/main/*"],
      "@/renderer/*": ["src/renderer/*"],
      "@/preload/*": ["src/preload/*"]
    }
  }
}
```

### Process-specific configs:

**tsconfig.main.json**:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/main",
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/shared/**/*"]
}
```

**tsconfig.renderer.json**:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "outDir": "dist/renderer",
    "types": ["react", "react-dom"]
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

## Testing Strategy

### Unit Tests

**Main Process (tests/unit/main/services/user-service.test.ts)**:
```typescript
import { UserService } from '@/main/services/user-service';
import { UserRepository } from '@/main/repositories/user-repository';

describe('UserService', () => {
  let service: UserService;
  let mockRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      save: jest.fn(),
    } as any;

    service = new UserService(mockRepo);
  });

  it('should get user by id', async () => {
    const mockUser = { id: '1', name: 'John' };
    mockRepo.findById.mockResolvedValue(mockUser);

    const result = await service.getUser('1');

    expect(result).toEqual(mockUser);
    expect(mockRepo.findById).toHaveBeenCalledWith('1');
  });
});
```

**Renderer (tests/unit/renderer/hooks/useUser.test.ts)**:
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useUser } from '@/renderer/hooks/useUser';

// Mock API
window.api = {
  getUser: jest.fn(),
};

describe('useUser', () => {
  it('should fetch user data', async () => {
    const mockUser = { id: '1', name: 'John' };
    (window.api.getUser as jest.Mock).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useUser('1'));

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });
  });
});
```

### Integration Tests

**IPC Communication (tests/integration/ipc.test.ts)**:
```typescript
import { ipcMain, ipcRenderer } from 'electron';

describe('IPC Communication', () => {
  it('should handle user:get request', async () => {
    const userId = '123';
    const mockUser = { id: userId, name: 'John' };

    // Setup handler
    ipcMain.handle('user:get', async (event, id) => {
      return mockUser;
    });

    // Test
    const result = await ipcRenderer.invoke('user:get', userId);
    expect(result).toEqual(mockUser);
  });
});
```

### E2E Tests (Playwright/Spectron)

```typescript
import { test, expect } from '@playwright/test';
import { ElectronApplication } from 'playwright';

test.describe('User Profile', () => {
  let app: ElectronApplication;

  test.beforeAll(async () => {
    app = await startElectronApp();
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('should display user profile', async () => {
    const page = await app.firstWindow();
    await page.click('[data-testid="profile-button"]');

    await expect(page.locator('[data-testid="user-name"]'))
      .toHaveText('John Doe');
  });
});
```

## Build Configuration

### Package.json Scripts:
```json
{
  "scripts": {
    "dev": "concurrently \"npm:dev:main\" \"npm:dev:renderer\"",
    "dev:main": "tsc -p tsconfig.main.json --watch",
    "dev:renderer": "vite",
    "build": "npm run build:main && npm run build:renderer",
    "build:main": "tsc -p tsconfig.main.json",
    "build:renderer": "vite build",
    "package": "electron-builder",
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "playwright test",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  }
}
```

## State Management Organization

### Redux Toolkit Pattern:

```
src/renderer/store/
├── index.ts                    # Store configuration
├── hooks.ts                    # Typed hooks
├── slices/
│   ├── userSlice.ts
│   ├── settingsSlice.ts
│   └── uiSlice.ts
└── middleware/
    └── ipcMiddleware.ts        # Sync with main process
```

### Zustand Pattern:

```
src/renderer/store/
├── index.ts
├── useUserStore.ts
├── useSettingsStore.ts
└── useUIStore.ts
```

## Naming Conventions

### Files:
- Components: `PascalCase.tsx` (e.g., `UserProfile.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Types: `PascalCase.ts` or `types.ts`
- Tests: `*.test.ts` or `*.spec.ts`

### Code:
- Interfaces: `IServiceName` or `ServiceName`
- Types: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Functions: `camelCase`
- Classes: `PascalCase`
- IPC Channels: `domain:action` (e.g., `user:get`)
