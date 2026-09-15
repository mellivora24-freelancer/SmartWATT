/**
 * App Configuration
 * Reads EXPO_PUBLIC_* variables from environment, with sensible defaults for local development.
 */

const DEFAULT_API_URL = 'http://localhost:8000';
const DEFAULT_WS_URL = 'ws://localhost:8000';

export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_URL,
  wsBaseUrl: process.env.EXPO_PUBLIC_WS_BASE_URL || DEFAULT_WS_URL,
  appEnv: process.env.EXPO_PUBLIC_APP_ENV || 'development',
  isDev: __DEV__,
};
