-- Active: 1789493419850@@127.0.0.1@5432@smartwatt
DROP TABLE IF EXISTS telemetry CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    electric_price NUMERIC(12,4) DEFAULT 0,
    water_price NUMERIC(12,4) DEFAULT 10000,
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
    min_water_flow NUMERIC(10,2) DEFAULT NULL,
    max_water_flow NUMERIC(10,2) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telemetry (
    id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    device_code VARCHAR(255) NOT NULL,
    power NUMERIC(12,2) NOT NULL,
    voltage NUMERIC(8,2) NOT NULL,
    current NUMERIC(10,4) NOT NULL,
    frequency NUMERIC(8,2) NOT NULL,
    power_factor NUMERIC(5,2) NOT NULL,
    energy_total NUMERIC(14,4) NOT NULL,
    water_flow_lpm NUMERIC(10,2) NOT NULL DEFAULT 0,
    water_total_l NUMERIC(14,4) NOT NULL DEFAULT 0,
    pulse_count BIGINT NOT NULL DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_device_code ON telemetry(device_code, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_device_time_water ON telemetry(device_id, timestamp DESC, water_total_l);
