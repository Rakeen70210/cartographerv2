# FogParticles Infinite Re-render Fix

## Issue
The FogParticles component was causing infinite re-renders due to circular dependencies in useEffect hooks.

## Root Cause
The main useEffect hook had `particleLifecycles` as a dependency, but the same effect was updating `particleLifecycles`, creating an infinite loop:

```typescript
useEffect(() => {
  // This effect updates particleLifecycles
  setParticleLifecycles(prev => {
    // ... updates
  });
}, [animations, visible, optimizeParticleCount, particleLifecycles]); // ❌ Circular dependency
```

## Fixes Applied

### 1. Removed Circular Dependencies
**Before:**
```typescript
useEffect(() => {
  // Updates particleLifecycles
}, [animations, visible, optimizeParticleCount, particleLifecycles]); // ❌ Causes infinite loop
```

**After:**
```typescript
useEffect(() => {
  // Updates particleLifecycles
}, [animations, visible, optimizeParticleCount]); // ✅ No circular dependency
```

### 2. Fixed handleParticleComplete Callback
**Before:**
```typescript
const handleParticleComplete = useCallback((particleId: string) => {
  const lifecycle = particleLifecycles.get(particleId); // ❌ Depends on state
  // ...
}, [particleLifecycles]); // ❌ Causes re-renders
```

**After:**
```typescript
const handleParticleComplete = useCallback((particleId: string) => {
  setParticleLifecycles(prev => {
    // Use functional update to access current state
    const existing = prev.get(particleId);
    // ...
  });
}, []); // ✅ No dependencies
```

### 3. Optimized State Updates
**Before:**
```typescript
setParticleLifecycles(prev => {
  const updated = new Map(prev);
  // Always return new map
  return updated;
});
```

**After:**
```typescript
setParticleLifecycles(prev => {
  const updated = new Map(prev);
  let hasNewParticles = false;
  
  // Only return new map if there are actual changes
  return hasNewParticles ? updated : prev;
});
```

### 4. Fixed Cleanup Effects
**Before:**
```typescript
useEffect(() => {
  return () => {
    // Cleanup logic
  };
}, [particleLifecycles]); // ❌ Unnecessary dependency
```

**After:**
```typescript
useEffect(() => {
  return () => {
    // Cleanup logic
  };
}, []); // ✅ Empty dependency for cleanup on unmount only
```

### 5. Improved Performance Monitoring
**Before:**
```typescript
useEffect(() => {
  // Monitoring logic that updates particleLifecycles
}, [visible, renderableParticles.length, particleLifecycles]); // ❌ Circular
```

**After:**
```typescript
useEffect(() => {
  // Use functional update to access current state without dependency
  setParticleLifecycles(prev => {
    // Access current state and return updated or same state
    return hasChanges ? updated : prev;
  });
}, [visible, renderableParticles.length]); // ✅ No circular dependency
```

## Key Principles Applied

1. **Avoid Circular Dependencies**: Never include state in useEffect dependencies if the effect updates that same state
2. **Use Functional Updates**: Use `setState(prev => ...)` to access current state without dependencies
3. **Minimize Dependencies**: Only include dependencies that actually trigger the effect
4. **Conditional Updates**: Only return new state objects when there are actual changes
5. **Proper Cleanup**: Use empty dependency arrays for cleanup effects that should only run on unmount

## Result
- ✅ No more infinite re-renders in FogParticles component
- ✅ Android app builds and runs successfully
- ✅ Particle animations work correctly without performance issues
- ✅ Proper cleanup and memory management maintained