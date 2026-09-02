export const OrganizationKind = {
  INTERNAL: "INTERNAL",
  PUBLISHER: "PUBLISHER",
  BUYER: "BUYER",
  CALL_CENTER: "CALL_CENTER",
} as const;
export type OrganizationKind = (typeof OrganizationKind)[keyof typeof OrganizationKind];

export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMINISTRATOR: "ADMINISTRATOR",
  OPERATIONS_MANAGER: "OPERATIONS_MANAGER",
  ACCOUNT_MANAGER: "ACCOUNT_MANAGER",
  FINANCE: "FINANCE",
  COMPLIANCE: "COMPLIANCE",
  PUBLISHER_ADMIN: "PUBLISHER_ADMIN",
  PUBLISHER_USER: "PUBLISHER_USER",
  BUYER_ADMIN: "BUYER_ADMIN",
  BUYER_USER: "BUYER_USER",
  CALL_CENTER_MANAGER: "CALL_CENTER_MANAGER",
  AGENT: "AGENT",
  READ_ONLY: "READ_ONLY",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const PublisherStatus = {
  PROSPECT: "PROSPECT",
  TESTING: "TESTING",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  SUSPENDED: "SUSPENDED",
  TERMINATED: "TERMINATED",
} as const;
export type PublisherStatus = (typeof PublisherStatus)[keyof typeof PublisherStatus];

export const BuyerStatus = {
  PROSPECT: "PROSPECT",
  TESTING: "TESTING",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  SUSPENDED: "SUSPENDED",
  TERMINATED: "TERMINATED",
} as const;
export type BuyerStatus = (typeof BuyerStatus)[keyof typeof BuyerStatus];

export const CampaignStatus = {
  DRAFT: "DRAFT",
  TESTING: "TESTING",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const CallStatus = {
  INCOMING: "INCOMING",
  IVR: "IVR",
  QUALIFYING: "QUALIFYING",
  AUCTIONING: "AUCTIONING",
  ROUTING: "ROUTING",
  RINGING: "RINGING",
  CONNECTED: "CONNECTED",
  TRANSFERRED: "TRANSFERRED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];

export const RoutingStrategy = {
  PRIORITY: "PRIORITY",
  WEIGHTED: "WEIGHTED",
  ROUND_ROBIN: "ROUND_ROBIN",
  LEAST_UTILIZED: "LEAST_UTILIZED",
  HIGHEST_REVENUE: "HIGHEST_REVENUE",
  HIGHEST_BID: "HIGHEST_BID",
  HIGHEST_EPC: "HIGHEST_EPC",
  HIGHEST_CONVERSION: "HIGHEST_CONVERSION",
  PREDICTIVE_SCORE: "PREDICTIVE_SCORE",
  MAX_GROSS_PROFIT: "MAX_GROSS_PROFIT",
  EXPECTED_VALUE: "EXPECTED_VALUE",
} as const;
export type RoutingStrategy = (typeof RoutingStrategy)[keyof typeof RoutingStrategy];

export const DialMode = {
  WATERFALL: "WATERFALL",
  SIMULTANEOUS: "SIMULTANEOUS",
} as const;
export type DialMode = (typeof DialMode)[keyof typeof DialMode];

export const ConversionModel = {
  DURATION: "DURATION",
  BUYER_API: "BUYER_API",
  WEBHOOK: "WEBHOOK",
  DISPOSITION: "DISPOSITION",
  MANUAL: "MANUAL",
  REVENUE_EVENT: "REVENUE_EVENT",
} as const;
export type ConversionModel = (typeof ConversionModel)[keyof typeof ConversionModel];

export const PricingModel = {
  CPL: "CPL",
  CPA: "CPA",
  PAY_PER_CALL: "PAY_PER_CALL",
  DURATION: "DURATION",
  FLAT: "FLAT",
  VARIABLE_BID: "VARIABLE_BID",
  REVENUE_SHARE: "REVENUE_SHARE",
  HYBRID: "HYBRID",
} as const;
export type PricingModel = (typeof PricingModel)[keyof typeof PricingModel];

export const NumberStatus = {
  AVAILABLE: "AVAILABLE",
  ASSIGNED: "ASSIGNED",
  RESERVED: "RESERVED",
  PORTING: "PORTING",
  RELEASED: "RELEASED",
} as const;
export type NumberStatus = (typeof NumberStatus)[keyof typeof NumberStatus];

export const NumberType = {
  LOCAL: "LOCAL",
  TOLL_FREE: "TOLL_FREE",
  MOBILE: "MOBILE",
} as const;
export type NumberType = (typeof NumberType)[keyof typeof NumberType];

export const RoutingAttemptResult = {
  ELIGIBLE: "ELIGIBLE",
  DIALED: "DIALED",
  NO_ANSWER: "NO_ANSWER",
  REJECTED: "REJECTED",
  BUSY: "BUSY",
  FAILED: "FAILED",
  ANSWERED: "ANSWERED",
  CANCELLED: "CANCELLED",
} as const;
export type RoutingAttemptResult =
  (typeof RoutingAttemptResult)[keyof typeof RoutingAttemptResult];

export const DuplicateAction = {
  REJECT: "REJECT",
  ROUTE_ELSEWHERE: "ROUTE_ELSEWHERE",
  LOWER_PRICE: "LOWER_PRICE",
  FLAG_ONLY: "FLAG_ONLY",
} as const;
export type DuplicateAction = (typeof DuplicateAction)[keyof typeof DuplicateAction];

export const DuplicateScope = {
  CAMPAIGN: "CAMPAIGN",
  VERTICAL: "VERTICAL",
  BUYER: "BUYER",
  PUBLISHER: "PUBLISHER",
  PLATFORM: "PLATFORM",
} as const;
export type DuplicateScope = (typeof DuplicateScope)[keyof typeof DuplicateScope];

export const InvoiceStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  DISPUTED: "DISPUTED",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentTerms = {
  PREPAID: "PREPAID",
  NET_7: "NET_7",
  NET_14: "NET_14",
  NET_15: "NET_15",
  NET_30: "NET_30",
  CUSTOM: "CUSTOM",
} as const;
export type PaymentTerms = (typeof PaymentTerms)[keyof typeof PaymentTerms];

export const AgentState = {
  OFFLINE: "OFFLINE",
  AVAILABLE: "AVAILABLE",
  BUSY: "BUSY",
  WRAP_UP: "WRAP_UP",
  BREAK: "BREAK",
} as const;
export type AgentState = (typeof AgentState)[keyof typeof AgentState];

export const CallEventType = {
  CALL_RECEIVED: "CALL_RECEIVED",
  CALLER_IDENTIFIED: "CALLER_IDENTIFIED",
  GEO_RESOLVED: "GEO_RESOLVED",
  DUPLICATE_DETECTED: "DUPLICATE_DETECTED",
  SUPPRESSION_HIT: "SUPPRESSION_HIT",
  IVR_STARTED: "IVR_STARTED",
  IVR_COMPLETED: "IVR_COMPLETED",
  ROUTING_STARTED: "ROUTING_STARTED",
  BUYER_ELIGIBLE: "BUYER_ELIGIBLE",
  BUYER_REJECTED: "BUYER_REJECTED",
  BUYER_SELECTED: "BUYER_SELECTED",
  AUCTION_STARTED: "AUCTION_STARTED",
  AUCTION_COMPLETED: "AUCTION_COMPLETED",
  BUYER_DIALED: "BUYER_DIALED",
  BUYER_NO_ANSWER: "BUYER_NO_ANSWER",
  BUYER_REJECTED_CALL: "BUYER_REJECTED_CALL",
  BUYER_BUSY: "BUYER_BUSY",
  BUYER_ANSWERED: "BUYER_ANSWERED",
  CALL_BRIDGED: "CALL_BRIDGED",
  CALL_ENDED: "CALL_ENDED",
  CONVERSION_CREATED: "CONVERSION_CREATED",
  CONVERSION_SKIPPED: "CONVERSION_SKIPPED",
  CALL_FAILED: "CALL_FAILED",
} as const;
export type CallEventType = (typeof CallEventType)[keyof typeof CallEventType];

export const DisputeReason = {
  SHORT_CALL: "SHORT_CALL",
  DUPLICATE: "DUPLICATE",
  WRONG_GEOGRAPHY: "WRONG_GEOGRAPHY",
  WRONG_VERTICAL: "WRONG_VERTICAL",
  UNQUALIFIED: "UNQUALIFIED",
  FRAUD: "FRAUD",
  TECHNICAL_FAILURE: "TECHNICAL_FAILURE",
  OTHER: "OTHER",
} as const;
export type DisputeReason = (typeof DisputeReason)[keyof typeof DisputeReason];
