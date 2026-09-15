/**
 * Formatting utilities for SmartWatt
 */

export function formatVND(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0 đ';
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(
  value: number | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }
  return Number(value).toFixed(decimals);
}

export function formatPower(watts: number | null | undefined): string {
  if (watts === null || watts === undefined || isNaN(watts)) {
    return '-- W';
  }
  if (Math.abs(watts) >= 1000) {
    return `${(watts / 1000).toFixed(2)} kW`;
  }
  return `${watts.toFixed(1)} W`;
}

export function formatEnergy(kwh: number | null | undefined): string {
  if (kwh === null || kwh === undefined || isNaN(kwh)) {
    return '-- kWh';
  }
  return `${kwh.toFixed(3)} kWh`;
}

export function formatWaterFlow(lpm: number | null | undefined): string {
  if (lpm === null || lpm === undefined || isNaN(lpm)) {
    return '-- L/phút';
  }
  return `${lpm.toFixed(2)} L/phút`;
}

export function formatWaterVolume(liters: number | null | undefined): string {
  if (liters === null || liters === undefined || isNaN(liters)) {
    return '-- L';
  }
  if (Math.abs(liters) >= 1000) {
    return `${(liters / 1000).toFixed(2)} m³`;
  }
  return `${liters.toFixed(1)} L`;
}

export function formatVoltage(volts: number | null | undefined): string {
  if (volts === null || volts === undefined || isNaN(volts)) {
    return '-- V';
  }
  return `${volts.toFixed(1)} V`;
}

export function formatCurrent(amps: number | null | undefined): string {
  if (amps === null || amps === undefined || isNaN(amps)) {
    return '-- A';
  }
  return `${amps.toFixed(2)} A`;
}

export function formatFrequency(hz: number | null | undefined): string {
  if (hz === null || hz === undefined || isNaN(hz)) {
    return '-- Hz';
  }
  return `${hz.toFixed(1)} Hz`;
}

export function formatPowerFactor(pf: number | null | undefined): string {
  if (pf === null || pf === undefined || isNaN(pf)) {
    return '--';
  }
  return pf.toFixed(2);
}

export function formatDateTime(
  dateString: string | Date | null | undefined
): string {
  if (!dateString) return '--';
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return String(dateString);

  const pad = (n: number) => (n < 10 ? `0${n}` : n);
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();

  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

export function formatShortDate(
  dateString: string | Date | null | undefined
): string {
  if (!dateString) return '--';
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return String(dateString);

  const pad = (n: number) => (n < 10 ? `0${n}` : n);
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);

  return `${day}/${month}`;
}

export function formatTimeOnly(
  dateString: string | Date | null | undefined
): string {
  if (!dateString) return '--';
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return String(dateString);

  const pad = (n: number) => (n < 10 ? `0${n}` : n);
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${hours}:${minutes}`;
}
