# Electron Architecture Best Practices

## Core Principles

### 1. Security First
- **Context Isolation**: Always enable context isolation in renderer processes
- **Node Integration**: Disable nodeIntegration in renderer processes
- **Preload Scripts**: Use preload scripts as the only bridge between main and renderer
- **Content Security Policy (CSP)**: Implement strict CSP headers
- **Validate IPC Messages**: Always validate and sanitize IPC messages

### 2. Process Separation
- **Main Process**: Business logic, native APIs, file system access, database
- **Renderer Process**: UI rendering, user interactions (treat as untrusted)
- **Preload Scripts**: Expose only necessary APIs through contextBridge
- **Never** expose entire Node.js or Electron APIs to renderer

### 3. Performance
- **Lazy Loading**: Load modules and components on demand
- **Code Splitting**: Split bundles to reduce initial load time
- **Worker Threads**: Offload CPU-intensive tasks to worker threads
- **Memory Management**: Clean up listeners, timers, and resources
- **Optimize Bundle Size**: Tree-shake unused code, minimize dependencies

### 4. Maintainability
- **Clear Module Boundaries**: Separate concerns (UI, business logic, data access)
- **Dependency Injection**: Use DI for testability and flexibility
- **TypeScript**: Use TypeScript for type safety and better tooling
- **Consistent Patterns**: Follow consistent IPC patterns across the app
- **Documentation**: Document architecture decisions and IPC contracts

## Common Anti-Patterns to Avoid

### Security Anti-Patterns
- **Exposing Entire APIs**: Never use `nodeIntegration: true` or expose full APIs
- **Unvalidated IPC**: Accepting IPC messages without validation
- **Loading Remote Content**: Loading untrusted remote content without sandbox
- **Shared State**: Sharing mutable state between processes

### Architecture Anti-Patterns
- **God Objects**: Creating massive main.js or single-file applications
- **Tight Coupling**: Direct dependencies between unrelated modules
- **Circular Dependencies**: Modules that depend on each other
- **Mixed Concerns**: Putting UI logic in main process or business logic in renderer
- **Callback Hell**: Deeply nested callbacks instead of promises/async-await

### Performance Anti-Patterns
- **Synchronous IPC**: Using ipcRenderer.sendSync (blocks renderer)
- **Large Bundles**: Shipping entire libraries when only parts are needed
- **Memory Leaks**: Not removing event listeners or cleaning up resources
- **Blocking Main Process**: Running CPU-intensive tasks in main process
- **Unnecessary Re-renders**: Not optimizing React/Vue component updates

## Architecture Quality Checklist

### Security
- [ ] Context isolation enabled
- [ ] Node integration disabled in renderer
- [ ] Preload scripts use contextBridge
- [ ] CSP headers configured
- [ ] IPC message validation implemented
- [ ] Remote module disabled
- [ ] Web security enabled

### Code Organization
- [ ] Clear separation of main/renderer/preload code
- [ ] Modular directory structure
- [ ] Consistent naming conventions
- [ ] TypeScript configured
- [ ] Linting rules enforced
- [ ] Tests cover critical paths

### Performance
- [ ] Code splitting implemented
- [ ] Lazy loading for non-critical modules
- [ ] Bundle size optimized
- [ ] No synchronous IPC calls
- [ ] Resource cleanup implemented
- [ ] Memory profiling done

### Maintainability
- [ ] Architecture documented
- [ ] IPC contracts documented
- [ ] Build process documented
- [ ] Error handling strategy defined
- [ ] Logging strategy implemented
- [ ] Update strategy planned
