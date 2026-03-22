import { configureStore } from '@reduxjs/toolkit'
import { prismApi } from './api'

export const store = configureStore({
  reducer: {
    [prismApi.reducerPath]: prismApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(prismApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
