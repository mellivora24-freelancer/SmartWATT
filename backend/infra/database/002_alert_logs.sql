CREATE TABLE IF NOT EXISTS alert_logs (
    id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    metric VARCHAR(50) NOT NULL,
    kind VARCHAR(10) NOT NULL,
    value NUMERIC(14,4) NOT NULL,
    limit_value NUMERIC(14,4) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_device_time
    ON alert_logs(device_id, created_at DESC);
