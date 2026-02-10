/**
 * Billing Module
 *
 * Comprehensive billing system for Platxa platform.
 * Includes workspace subscriptions and outcome-based deployment billing.
 *
 * @module billing
 */

// Workspace billing (subscription-based)
export {
  type SubscriptionPlan,
  type SubscriptionStatus,
  type BillingInterval,
  type PaymentMethod,
  type Workspace,
  type WorkspaceSettings,
  type MemberRole,
  type WorkspaceMember,
  type Subscription,
  type SubscriptionDiscount,
  type PlanDetails,
  type PlanLimits,
  type PlanPricing,
  type MemberUsage,
  type WorkspaceUsage,
  type Invoice,
  type InvoiceLineItem,
  type PaymentMethodInfo,
  type BillingAlert,
  PLANS,
  WorkspaceBillingManager,
  getBillingManager,
} from "./workspace-billing"

// Deployment billing (outcome-based)
export {
  // Types
  type DeploymentBillingStatus,
  type DeploymentOutcome,
  type CreditReservation,
  type DeploymentBillingRecord,
  type BillingResult,
  type DeploymentBillingConfig,
  type DeploymentBillingAnalytics,
  // Constants
  DEFAULT_BILLING_CONFIG,
  // Core functions
  reserveCredits,
  releaseReservation,
  chargeForSuccessfulDeployment,
  refundFailedDeployment,
  processDeploymentOutcome,
  // Utilities
  getDeploymentBillingRecord,
  getUserBillingAnalytics,
  waiveDeploymentBilling,
  canAffordDeployment,
  getDeploymentCost,
  cleanupExpiredReservations,
} from "./deployment-billing"

// Partner program (whitelabel/reseller)
export {
  // Types
  type PartnerTier,
  type PartnerStatus,
  type CommissionType,
  type PayoutStatus,
  type WhitelabelBranding,
  type PartnerTierConfig,
  type WhitelabelFeatures,
  type Partner,
  type CommissionConfig,
  type PartnerBilling,
  type PartnerSettings,
  type PartnerClient,
  type CommissionRecord,
  type PayoutRecord,
  type PartnerDashboard,
  type MonthlyStats,
  type AllTimeStats,
  type CreatePartnerInput,
  type UpdatePartnerInput,
  // Constants
  PARTNER_TIERS,
  // Classes
  PartnerProgram,
  // Functions
  getPartnerProgram,
  createPartnerProgram,
  createPartner,
  getPartnerDashboard,
  getBrandingForDomain,
  getPartnerTierConfig,
  getAllPartnerTiers,
} from "./partner-program"
