import { apiClient } from './client';
import {
  AggregationLevel,
  AlertItem,
  AuthResponse,
  BaselineResponse,
  ChatResponse,
  DeviationResponse,
  Device,
  DeviceCreate,
  DeviceUpdate,
  ForecastResponse,
  SummaryResponse,
  TelemetryListResponse,
  ThresholdApplyResponse,
  ThresholdSuggestionsResponse,
  User,
  UserUpdate,
  WaterLeakResponse,
} from './types';

// Auth Endpoints
export const authApi = {
  register: (payload: {
    name: string;
    phone: string;
    password: string;
    electric_price?: number;
    water_price?: number;
  }) =>
    apiClient<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    }),

  login: (payload: { phone: string; password: string }) =>
    apiClient<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    }),
};

// User Endpoints
export const usersApi = {
  getMe: () => apiClient<User>('/users/me'),
  updateMe: (payload: UserUpdate) =>
    apiClient<User>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};

// Device Endpoints
export const devicesApi = {
  list: () => apiClient<Device[]>('/devices'),

  create: (payload: DeviceCreate) =>
    apiClient<Device>('/devices', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  get: (id: number) => apiClient<Device>(`/devices/${id}`),

  update: (id: number, payload: DeviceUpdate) =>
    apiClient<Device>(`/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  remove: (id: number) =>
    apiClient<{ detail: string }>(`/devices/${id}`, {
      method: 'DELETE',
    }),

  getTelemetry: (
    id: number,
    params?: { start?: string; end?: string; limit?: number; offset?: number }
  ) => {
    const query = new URLSearchParams();
    if (params?.start) query.append('start', params.start);
    if (params?.end) query.append('end', params.end);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset !== undefined) query.append('offset', String(params.offset));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<TelemetryListResponse>(`/devices/${id}/telemetry${qs}`);
  },

  getSummary: (
    id: number,
    params: { level: AggregationLevel; start?: string; end?: string }
  ) => {
    const query = new URLSearchParams({ level: params.level });
    if (params.start) query.append('start', params.start);
    if (params.end) query.append('end', params.end);
    return apiClient<SummaryResponse>(`/devices/${id}/summary?${query.toString()}`);
  },

  getForecast: (id: number) => apiClient<ForecastResponse>(`/devices/${id}/forecast`),

  getAlerts: (id: number, limit: number = 50) =>
    apiClient<AlertItem[]>(`/devices/${id}/alerts?limit=${limit}`),
};

// Alerts Endpoints
export const alertsApi = {
  delete: (alertId: number) =>
    apiClient<{ status: string; deleted_id: number }>(
      `/devices/alerts/${alertId}`,
      {
        method: 'DELETE',
      }
    ),
};

// Analytics Endpoints
export const analyticsApi = {
  getBaseline: (id: number, weeks?: number) => {
    const qs = weeks ? `?weeks=${weeks}` : '';
    return apiClient<BaselineResponse>(`/devices/${id}/baseline${qs}`);
  },

  getDeviation: (id: number, params?: { date?: string; weeks?: number }) => {
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.weeks) query.append('weeks', String(params.weeks));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<DeviationResponse>(`/devices/${id}/deviation${qs}`);
  },

  getWaterLeak: (id: number, days: number = 14) =>
    apiClient<WaterLeakResponse>(`/devices/${id}/water-leak?days=${days}`),

  getThresholdSuggestions: (id: number, days?: number) => {
    const qs = days ? `?days=${days}` : '';
    return apiClient<ThresholdSuggestionsResponse>(
      `/devices/${id}/threshold-suggestions${qs}`
    );
  },

  applyThresholdSuggestions: (id: number, columns: string[]) =>
    apiClient<ThresholdApplyResponse>(
      `/devices/${id}/threshold-suggestions/apply`,
      {
        method: 'POST',
        body: JSON.stringify({ columns }),
      }
    ),
};

// AI Chat Endpoints
export const aiApi = {
  chat: (deviceId: number, prompt: string) =>
    apiClient<ChatResponse>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, prompt }),
      timeoutMs: 30000,
    }),
};
