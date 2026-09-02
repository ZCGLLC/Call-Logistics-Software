import { minutesOfDay, zonedParts } from "@zcg/shared";
import type { HoursWindow } from "./types.js";

export function isOpenAt(hours: HoursWindow | null, now: Date): { open: boolean; reason?: string } {
  if (!hours) return { open: true };
  if (hours.temporaryClosed) return { open: false, reason: "temporary override closed" };
  if (hours.temporaryOpen) return { open: true };

  const parts = zonedParts(now, hours.timezone);
  if (hours.holidays.includes(parts.ymd)) {
    return { open: false, reason: `holiday ${parts.ymd}` };
  }
  if (hours.blackoutDates.includes(parts.ymd)) {
    return { open: false, reason: `blackout ${parts.ymd}` };
  }
  if (hours.days.length > 0 && !hours.days.includes(parts.weekday)) {
    return { open: false, reason: `closed on weekday ${parts.weekday} (${hours.timezone})` };
  }
  const nowMin = minutesOfDay(parts.hour, parts.minute);
  if (hours.openMinutes === hours.closeMinutes) {
    return { open: true };
  }
  const wraps = hours.closeMinutes < hours.openMinutes;
  const inWindow = wraps
    ? nowMin >= hours.openMinutes || nowMin < hours.closeMinutes
    : nowMin >= hours.openMinutes && nowMin < hours.closeMinutes;
  if (!inWindow) {
    return {
      open: false,
      reason: `outside hours ${fmt(hours.openMinutes)}–${fmt(hours.closeMinutes)} ${hours.timezone}`,
    };
  }
  return { open: true };
}

function fmt(mins: number): string {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
