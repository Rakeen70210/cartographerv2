import { configureStore } from '@reduxjs/toolkit';
import { mapSlice, locationSlice, explorationSlice } from './slices';
import fogSlice from './slices/fogSlice';
import profileSlice from './slices/profileSlice';

export const store = configureStore({
  reducer: {
    map: mapSlice,
    location: locationSlice,
    exploration: explorationSlice,
    fog: fogSlice,
    profile: profileSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serializable check
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;