import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true } },
});

export function withCall(callId: string, extra?: Record<string, unknown>) {
  return logger.child({ call_id: callId, ...extra });
}
