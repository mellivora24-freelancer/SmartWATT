/**
 * TypeScript definitions matching SmartWatt backend API & models
 */

export interface User {
  id: number;
  name: string;
  phone: string;
  electric_price: number;
  water_price?: number;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ThresholdFields {
  min_voltage?: number | null;
  max_voltage?: number | null;
  min_current?: number | null;
  max_current?: number | null;
  min_power?: number | null;
  max_power?: number | null;
  min_frequency?: number | null;
  max_frequency?: number | null;
  min_power_factor?: number | null;
  max_power_factor?: number | null;
  min_water_flow?: number | null;
  max_water_flow?: number | null;
}

export interface Device extends ThresholdFields {
  id: number;
  user_id: number | null;
  code: string;
  name: string | null;
  location: string | null;
  created_at?: string;
  updated_at?: string;
  latest_telemetry?: TelemetryItem | null;
}

export interface DeviceCreate extends ThresholdFields {
  code: string;
  name?: string | null;
  location?: string | null;
}

export interface DeviceUpdate extends ThresholdFields {
  name?: string | null;
  location?: string | null;
}

export interface UserUpdate {
  name?: string | null;
  phone?: string | null;
  password?: string | null;
  electric_price?: number | null;
  water_price?: number | null;
}

export interface TelemetryItem {
  id?: number;
  device_id?: number;
  device_code?: string;
  voltage: number;
  current: number;
  power: number;
  power_factor: number;
  frequency: number;
  energy_total: number;
  water_flow_lpm: number;
  water_total_l: number;
  pulse_count?: number;
  timestamp: string;
}

export interface TelemetryListResponse {
  total: number;
  limit: number;
  offset: number;
  items: TelemetryItem[];
}

export interface TelemetrySummaryBucket {
  bucket: string;
  avg_voltage: number | null;
  max_voltage: number | null;
  min_voltage: number | null;
  avg_current: number | null;
  max_current: number | null;
  avg_power: number | null;
  max_power: number | null;
  avg_frequency: number | null;
  avg_power_factor: number | null;
  avg_water_flow: number | null;
  max_water_flow: number | null;
  energy_kwh: number | null;
  water_l: number | null;
  samples: number;
}

export type AggregationLevel = 'minute' | 'hour' | 'day' | 'month' | 'year';

export interface SummaryResponse {
  level: AggregationLevel;
  start: string;
  end: string;
  buckets: TelemetrySummaryBucket[];
}

export interface ForecastResponse {
  period: {
    year: number;
    month: number;
    days_in_month: number;
    current_day: number;
  };
  electric_price: number;
  water_price: number;
  electric: {
    current_kwh: number;
    current_cost: number;
    predicted_kwh: number;
    predicted_cost: number;
    previous_month_kwh: number | null;
    previous_month_cost?: number | null;
    trend: 'up' | 'down';
  };
  water: {
    current_l: number;
    current_m3?: number;
    current_cost: number;
    predicted_l: number;
    predicted_m3?: number;
    predicted_cost: number;
    previous_month_l: number | null;
    previous_month_m3?: number | null;
    previous_month_cost?: number | null;
    trend: 'up' | 'down';
  };
}

export interface AlertItem {
  id?: number;
  device_id: number;
  device_code?: string;
  metric: string;
  value: number;
  threshold?: number;
  rule_type?: string;
  severity?: 'warning' | 'danger' | 'info';
  message?: string;
  timestamp: string;
  created_at?: string;
}

export interface WaterLeakNight {
  night: string;
  samples: number;
  volume_l: number;
  flowing_ratio: number;
  max_flow_lpm: number;
  avg_flow_lpm: number;
  verdict: 'normal' | 'leak_continuous' | 'leak_burst' | 'insufficient_data';
  reason: string;
}

export interface WaterLeakResponse {
  days: number;
  window: {
    start_hour: number;
    end_hour: number;
    flow_threshold_lpm: number;
  };
  baseline: {
    ready: boolean;
    nights: number;
    min_nights: number;
    median_volume_l: number | null;
    threshold_volume_l: number;
  };
  status: 'ok' | 'leak_suspected' | 'insufficient_data';
  latest_verdict: string;
  nights: WaterLeakNight[];
  current: {
    timestamp: string;
    water_flow_lpm: number;
    in_night_window: boolean;
    flowing_now: boolean;
  } | null;
}

export interface BaselineCell {
  weekday: number;
  weekday_label: string;
  hour: number;
  power_center: number | null;
  power_mad: number | null;
  water_center: number | null;
  water_mad: number | null;
  sample_days: number;
  ready: boolean;
}

export interface BaselineResponse {
  weeks: number;
  min_days: number;
  start: string;
  end: string;
  ready_cells: number;
  cells: BaselineCell[];
}

export interface DeviationHourEntry {
  hour: number;
  sample_count: number;
  power_actual: number | null;
  power_center: number | null;
  power_mad: number | null;
  power_z: number | null;
  water_actual: number | null;
  water_center: number | null;
  water_mad: number | null;
  water_z: number | null;
  power_status: 'normal' | 'high' | 'low' | 'no_data' | 'no_baseline';
  water_status: 'normal' | 'high' | 'low' | 'no_data' | 'no_baseline';
}

export interface DeviationResponse {
  target_date?: string;
  weekday?: number;
  weekday_label?: string;
  ready?: boolean;
  hours?: DeviationHourEntry[];
  power_abnormal_hours?: number[];
  water_abnormal_hours?: number[];
  [key: string]: any;
}

export interface ThresholdSuggestionItem {
  metric: string;
  column: string;
  direction: 'min' | 'max';
  percentile: number | null;
  observed_value: number | null;
  current_value: number | null;
  suggested_value: number | null;
  status: 'ok' | 'too_tight' | 'too_loose' | 'missing' | 'insufficient_data';
  sample_count: number;
}

export interface ThresholdSuggestionsResponse {
  days: number;
  samples: number;
  loaded_samples: number;
  min_samples: number;
  margin_percent: number;
  ready: boolean;
  suggestions: ThresholdSuggestionItem[];
  not_derived: Array<{ column: string; reason: string }>;
}

export interface ThresholdApplyResponse {
  applied: string[];
  device: Device;
  suggestions: ThresholdSuggestionItem[];
}

export interface ChatResponse {
  device_id: number;
  answer: string;
}

export interface WebSocketMessage {
  type: 'telemetry' | 'alert';
  device_id: number;
  device_code: string;
  data: any;
  alerts?: AlertItem[];
}
