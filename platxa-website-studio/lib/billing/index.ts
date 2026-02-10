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
