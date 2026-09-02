import { UserRole } from "./enums.js";

export const Permission = {
  PLATFORM_ALL: "platform:all",
  PII_READ: "pii:read",
  RECORDINGS_LISTEN: "recordings:listen",
  PUBLISHERS_READ: "publishers:read",
  PUBLISHERS_WRITE: "publishers:write",
  BUYERS_READ: "buyers:read",
  BUYERS_WRITE: "buyers:write",
  BUYER_RATES_WRITE: "buyers:rates:write",
  CAMPAIGNS_READ: "campaigns:read",
  CAMPAIGNS_WRITE: "campaigns:write",
  CALLS_READ: "calls:read",
  CALLS_WRITE: "calls:write",
  FINANCIALS_READ: "financials:read",
  FINANCIALS_WRITE: "financials:write",
  ROUTING_READ: "routing:read",
  ROUTING_WRITE: "routing:write",
  REPORTS_READ: "reports:read",
  SETTINGS_WRITE: "settings:write",
  AUDIT_READ: "audit:read",
  MARGIN_READ: "margin:read",
  BUYER_IDENTITY_READ: "buyer-identity:read",
  API_KEYS_WRITE: "apikeys:write",
  WEBHOOKS_WRITE: "webhooks:write",
  LEADS_WRITE: "leads:write",
  DISPUTES_WRITE: "disputes:write",
  IMPORT_WRITE: "import:write",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL: Permission[] = Object.values(Permission);

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ALL,
  ADMINISTRATOR: ALL.filter((p) => p !== Permission.PLATFORM_ALL),
  OPERATIONS_MANAGER: [
    Permission.PII_READ,
    Permission.RECORDINGS_LISTEN,
    Permission.PUBLISHERS_READ,
    Permission.PUBLISHERS_WRITE,
    Permission.BUYERS_READ,
    Permission.BUYERS_WRITE,
    Permission.CAMPAIGNS_READ,
    Permission.CAMPAIGNS_WRITE,
    Permission.CALLS_READ,
    Permission.CALLS_WRITE,
    Permission.FINANCIALS_READ,
    Permission.ROUTING_READ,
    Permission.ROUTING_WRITE,
    Permission.REPORTS_READ,
    Permission.MARGIN_READ,
    Permission.BUYER_IDENTITY_READ,
    Permission.API_KEYS_WRITE,
    Permission.WEBHOOKS_WRITE,
    Permission.LEADS_WRITE,
    Permission.DISPUTES_WRITE,
    Permission.IMPORT_WRITE,
  ],
  ACCOUNT_MANAGER: [
    Permission.PUBLISHERS_READ,
    Permission.PUBLISHERS_WRITE,
    Permission.BUYERS_READ,
    Permission.CAMPAIGNS_READ,
    Permission.CAMPAIGNS_WRITE,
    Permission.CALLS_READ,
    Permission.REPORTS_READ,
    Permission.BUYER_IDENTITY_READ,
  ],
  FINANCE: [
    Permission.PUBLISHERS_READ,
    Permission.BUYERS_READ,
    Permission.CALLS_READ,
    Permission.FINANCIALS_READ,
    Permission.FINANCIALS_WRITE,
    Permission.REPORTS_READ,
    Permission.MARGIN_READ,
    Permission.AUDIT_READ,
    Permission.DISPUTES_WRITE,
  ],
  COMPLIANCE: [
    Permission.PII_READ,
    Permission.RECORDINGS_LISTEN,
    Permission.CALLS_READ,
    Permission.REPORTS_READ,
    Permission.AUDIT_READ,
  ],
  PUBLISHER_ADMIN: [
    Permission.CAMPAIGNS_READ,
    Permission.CALLS_READ,
    Permission.REPORTS_READ,
    Permission.FINANCIALS_READ,
    Permission.LEADS_WRITE,
    Permission.API_KEYS_WRITE,
    Permission.WEBHOOKS_WRITE,
  ],
  PUBLISHER_USER: [Permission.CAMPAIGNS_READ, Permission.CALLS_READ, Permission.REPORTS_READ, Permission.LEADS_WRITE],
  BUYER_ADMIN: [
    Permission.CAMPAIGNS_READ,
    Permission.CALLS_READ,
    Permission.RECORDINGS_LISTEN,
    Permission.REPORTS_READ,
    Permission.FINANCIALS_READ,
    Permission.DISPUTES_WRITE,
    Permission.API_KEYS_WRITE,
    Permission.WEBHOOKS_WRITE,
  ],
  BUYER_USER: [Permission.CAMPAIGNS_READ, Permission.CALLS_READ, Permission.REPORTS_READ, Permission.DISPUTES_WRITE],
  CALL_CENTER_MANAGER: [
    Permission.PII_READ,
    Permission.CALLS_READ,
    Permission.CALLS_WRITE,
    Permission.RECORDINGS_LISTEN,
  ],
  AGENT: [Permission.CALLS_READ, Permission.CALLS_WRITE],
  READ_ONLY: [Permission.REPORTS_READ, Permission.CALLS_READ, Permission.CAMPAIGNS_READ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const set = ROLE_PERMISSIONS[role];
  return set.includes(Permission.PLATFORM_ALL) || set.includes(permission);
}

export function isInternalRole(role: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.ADMINISTRATOR ||
    role === UserRole.OPERATIONS_MANAGER ||
    role === UserRole.ACCOUNT_MANAGER ||
    role === UserRole.FINANCE ||
    role === UserRole.COMPLIANCE ||
    role === UserRole.READ_ONLY
  );
}

export function canSeeBuyerIdentity(role: UserRole): boolean {
  return hasPermission(role, Permission.BUYER_IDENTITY_READ);
}

export function canSeeMargin(role: UserRole): boolean {
  return hasPermission(role, Permission.MARGIN_READ);
}

export function isPublisherRole(role: UserRole): boolean {
  return role === UserRole.PUBLISHER_ADMIN || role === UserRole.PUBLISHER_USER;
}

export function isBuyerRole(role: UserRole): boolean {
  return role === UserRole.BUYER_ADMIN || role === UserRole.BUYER_USER;
}
