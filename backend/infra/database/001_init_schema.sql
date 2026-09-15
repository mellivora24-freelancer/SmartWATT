CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    electric_price NUMERIC(12,4) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    code VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL DEFAULT 'New Device',
    location VARCHAR(255) DEFAULT NULL,
    min_power NUMERIC(12,2) DEFAULT NULL,
    max_power NUMERIC(12,2) DEFAULT NULL,
    min_voltage NUMERIC(8,2) DEFAULT NULL,
    max_voltage NUMERIC(8,2) DEFAULT NULL,
    min_current NUMERIC(8,2) DEFAULT NULL,
    max_current NUMERIC(8,2) DEFAULT NULL,
    min_frequency NUMERIC(8,2) DEFAULT NULL,
    max_frequency NUMERIC(8,2) DEFAULT NULL,
    min_power_factor NUMERIC(5,2) DEFAULT NULL,
    max_power_factor NUMERIC(5,2) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telemetry_raw (
    id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    device_code VARCHAR(255) NOT NULL,
    power NUMERIC(12,2) NOT NULL,
    voltage NUMERIC(8,2) NOT NULL,
    current NUMERIC(10,4) NOT NULL,
    frequency NUMERIC(8,2) NOT NULL,
    power_factor NUMERIC(5,2) NOT NULL,
    energy_total NUMERIC(14,4) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_raw_device_time ON telemetry_raw(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_raw_device_code ON telemetry_raw(device_code, timestamp DESC);
