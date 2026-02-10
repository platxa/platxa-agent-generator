/**
 * Deployment Billing Service - Outcome-Based Pricing
 *
 * Implements pay-per-successful-deployment billing model.
 * Only charges credits when a theme deployment is verified successful.
 *
 * Key Features:
 * - Deferred billing: Charge only after deployment verification
 * - Automatic refunds: Credit back for failed deployments
 * - Deployment tracking: Link billing events to deployment records
 * - Analytics: Track conversion rates and billing metrics
 *
 * @example
 * ```typescript
 * import { DeploymentBillingService } from "@/lib/billing/deployment-billing"
 *
 * const billing = new DeploymentBillingService()
 *
 * // Reserve credits before deployment (optional)
 * const reservation = await billing.reserveCredits(userId, deploymentId)
 *
 * // Charge after successful deployment
 * if (deployment.success) {
 *   await billing.chargeForSuccessfulDeployment(userId, deploymentId)
 * } else {
 *   await billing.releaseReservation(reservation.id)
 * }
 * ```
 *
 * @module billing/deployment-billing
 */

import {
  deductCredits,
  addCredits,
  hasCredits,
  CREDIT_COSTS,
  type DeductResult,
  type TransactionType,
} from "../services/credit-service"

// =============================================================================
// Types
// =============================================================================

/** Billing status for a deployment */
export type DeploymentBillingStatus =
  | "pending"      // Deployment initiated, not yet verified
  | "reserved"     // Credits reserved but not charged
  | "charged"      // Credits deducted after successful deployment
  | "refunded"     // Credits returned after failed deployment
  | "waived"       // Billing waived (e.g., free tier, promotional)

/** Deployment outcome for billing purposes */
export type DeploymentOutcome =
  | "success"      // Theme successfully deployed and verified
  | "partial"      // Partially deployed (some errors)
  | "failed"       // Deployment failed completely
  | "timeout"      // Deployment timed out
  | "cancelled"    // User cancelled deployment

/** Credit reservation for pending deployment */
export interface CreditReservation {
  /** Unique reservation ID */
  id: string
  /** User ID */
  userId: string
  /** Deployment ID */
  deploymentId: string
  /** Reserved amount */
  amount: number
  /** Reservation timestamp */
  createdAt: Date
  /** Expiration timestamp */
  expiresAt: Date
  /** Whether the reservation is still active */
  active: boolean
}

/** Deployment billing record */
export interface DeploymentBillingRecord {
  /** Deployment ID */
  deploymentId: string
  /** User ID */
  userId: string
  /** Project ID (if applicable) */
  projectId?: string
  /** Billing status */
  status: DeploymentBillingStatus
  /** Amount charged (or reserved) */
  amount: number
  /** Deployment outcome */
  outcome?: DeploymentOutcome
  /** Associated transaction ID */
  transactionId?: string
  /** Reservation ID (if using deferred billing) */
  reservationId?: string
  /** Target Odoo URL */
  targetUrl?: string
  /** Module name deployed */
  moduleName?: string
  /** Deployment duration in ms */
  deploymentDurationMs?: number
  /** Billing timestamp */
  billedAt?: Date
  /** Error message (if failed) */
  error?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/** Result of a billing operation */
export interface BillingResult {
  /** Whether the operation succeeded */
  success: boolean
  /** New credit balance */
  balance?: number
  /** Transaction ID */
  transactionId?: string
  /** Reservation ID */
  reservationId?: string
  /** Error message */
  error?: string
}

/** Billing configuration */
export interface DeploymentBillingConfig {
  /** Base cost per successful deployment */
  baseCost: number
  /** Reservation timeout in seconds */
  reservationTimeoutSeconds: number
  /** Whether to auto-refund on failure */
  autoRefundOnFailure: boolean
  /** Whether to charge for partial deployments */
  chargeForPartial: boolean
  /** Partial deployment charge ratio (0.0 - 1.0) */
  partialChargeRatio: number
}

/** Billing analytics */
export interface DeploymentBillingAnalytics {
  /** Total deployments attempted */
  totalAttempts: number
  /** Successful deployments charged */
  successfulCharges: number
  /** Failed deployments (no charge) */
  failedNoCharge: number
  /** Refunds issued */
  refundsIssued: number
  /** Total credits charged */
  totalCreditsCharged: number
  /** Total credits refunded */
  totalCreditsRefunded: number
  /** Net credits (charged - refunded) */
  netCredits: number
  /** Success rate */
  successRate: number
  /** Average deployment cost */
  averageCost: number
}

// =============================================================================
// Constants
// =============================================================================

/** Default billing configuration */
export const DEFAULT_BILLING_CONFIG: DeploymentBillingConfig = {
  baseCost: CREDIT_COSTS.DEPLOYMENT,
  reservationTimeoutSeconds: 3600, // 1 hour
  autoRefundOnFailure: true,
  chargeForPartial: false,
  partialChargeRatio: 0.5,
}

/** Reservation storage (in production, use database) */
const reservations = new Map<string, CreditReservation>()

/** Billing records storage (in production, use database) */
const billingRecords = new Map<string, DeploymentBillingRecord>()

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generates a unique ID for reservations and records
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${timestamp}_${random}`
}

/**
 * Calculates the charge amount based on outcome and config
 */
function calculateChargeAmount(
  outcome: DeploymentOutcome,
  config: DeploymentBillingConfig,
): number {
  switch (outcome) {
    case "success":
      return config.baseCost
    case "partial":
      return config.chargeForPartial
        ? Math.round(config.baseCost * config.partialChargeRatio)
        : 0
    case "failed":
    case "timeout":
    case "cancelled":
      return 0
    default:
      return 0
  }
}

// =============================================================================
// Core Billing Functions
// =============================================================================

/**
 * Reserve credits for a pending deployment
 *
 * This is optional but recommended for outcome-based billing.
 * Reserves credits upfront to ensure they're available,
 * then either charges or releases them based on outcome.
 */
export async function reserveCredits(
  userId: string,
  deploymentId: string,
  amount: number = CREDIT_COSTS.DEPLOYMENT,
  config: Partial<DeploymentBillingConfig> = {},
): Promise<BillingResult> {
  const finalConfig = { ...DEFAULT_BILLING_CONFIG, ...config }

  // Check if user has enough credits
  const canReserve = await hasCredits(userId, amount)
  if (!canReserve) {
    return {
      success: false,
      error: "Insufficient credits for deployment",
    }
  }

  // Create reservation
  const reservationId = generateId("res")
  const now = new Date()
  const expiresAt = new Date(now.getTime() + finalConfig.reservationTimeoutSeconds * 1000)

  const reservation: CreditReservation = {
    id: reservationId,
    userId,
    deploymentId,
    amount,
    createdAt: now,
    expiresAt,
    active: true,
  }

  reservations.set(reservationId, reservation)

  // Create billing record
  const record: DeploymentBillingRecord = {
    deploymentId,
    userId,
    status: "reserved",
    amount,
    reservationId,
  }
  billingRecords.set(deploymentId, record)

  return {
    success: true,
    reservationId,
  }
}

/**
 * Release a credit reservation without charging
 *
 * Called when deployment fails or is cancelled.
 */
export async function releaseReservation(
  reservationId: string,
): Promise<BillingResult> {
  const reservation = reservations.get(reservationId)

  if (!reservation) {
    return {
      success: false,
      error: "Reservation not found",
    }
  }

  if (!reservation.active) {
    return {
      success: false,
      error: "Reservation already processed",
    }
  }

  // Mark reservation as inactive
  reservation.active = false
  reservations.set(reservationId, reservation)

  // Update billing record
  const record = billingRecords.get(reservation.deploymentId)
  if (record) {
    record.status = "pending"
    billingRecords.set(reservation.deploymentId, record)
  }

  return {
    success: true,
    reservationId,
  }
}

/**
 * Charge for a successful deployment
 *
 * This is the main billing function for outcome-based pricing.
 * Only deducts credits when a deployment is verified successful.
 */
export async function chargeForSuccessfulDeployment(
  userId: string,
  deploymentId: string,
  options: {
    projectId?: string
    targetUrl?: string
    moduleName?: string
    durationMs?: number
    reservationId?: string
    metadata?: Record<string, unknown>
  } = {},
): Promise<BillingResult> {
  const amount = CREDIT_COSTS.DEPLOYMENT

  // If there's a reservation, validate and consume it
  if (options.reservationId) {
    const reservation = reservations.get(options.reservationId)
    if (!reservation || !reservation.active) {
      return {
        success: false,
        error: "Invalid or expired reservation",
      }
    }
    reservation.active = false
    reservations.set(options.reservationId, reservation)
  }

  // Deduct credits
  const result = await deductCredits(
    userId,
    amount,
    "DEPLOYMENT" as TransactionType,
    `Successful deployment${options.targetUrl ? ` to ${options.targetUrl}` : ""}`,
    options.projectId,
    {
      deploymentId,
      outcome: "success",
      moduleName: options.moduleName,
      durationMs: options.durationMs,
      ...options.metadata,
    },
  )

  if (!result.success) {
    return {
      success: false,
      error: result.error || "Failed to charge for deployment",
    }
  }

  // Create/update billing record
  const record: DeploymentBillingRecord = {
    deploymentId,
    userId,
    projectId: options.projectId,
    status: "charged",
    amount,
    outcome: "success",
    transactionId: result.transactionId || undefined,
    reservationId: options.reservationId,
    targetUrl: options.targetUrl,
    moduleName: options.moduleName,
    deploymentDurationMs: options.durationMs,
    billedAt: new Date(),
    metadata: options.metadata,
  }
  billingRecords.set(deploymentId, record)

  return {
    success: true,
    balance: result.newBalance,
    transactionId: result.transactionId || undefined,
  }
}

/**
 * Refund credits for a failed deployment
 *
 * Only applicable if credits were pre-charged (not using reservation model).
 */
export async function refundFailedDeployment(
  userId: string,
  deploymentId: string,
  originalTransactionId: string,
  reason: string,
): Promise<BillingResult> {
  const amount = CREDIT_COSTS.DEPLOYMENT

  // Add credits back
  const result = await addCredits(
    userId,
    amount,
    "REFUND" as TransactionType,
    `Refund for failed deployment: ${reason}`,
    {
      deploymentId,
      originalTransactionId,
      reason,
    },
  )

  if (!result.success) {
    return {
      success: false,
      error: result.error || "Failed to refund deployment",
    }
  }

  // Update billing record
  const record = billingRecords.get(deploymentId)
  if (record) {
    record.status = "refunded"
    record.outcome = "failed"
    record.error = reason
    billingRecords.set(deploymentId, record)
  }

  return {
    success: true,
    balance: result.newBalance,
    transactionId: result.transactionId || undefined,
  }
}

/**
 * Process deployment outcome for billing
 *
 * Unified function that handles all billing based on deployment outcome.
 * Automatically charges, refunds, or waives based on the result.
 */
export async function processDeploymentOutcome(
  userId: string,
  deploymentId: string,
  outcome: DeploymentOutcome,
  options: {
    projectId?: string
    targetUrl?: string
    moduleName?: string
    durationMs?: number
    reservationId?: string
    error?: string
    metadata?: Record<string, unknown>
  } = {},
  config: Partial<DeploymentBillingConfig> = {},
): Promise<BillingResult> {
  const finalConfig = { ...DEFAULT_BILLING_CONFIG, ...config }

  // Calculate charge based on outcome
  const chargeAmount = calculateChargeAmount(outcome, finalConfig)

  // If no charge needed, release any reservation
  if (chargeAmount === 0) {
    if (options.reservationId) {
      await releaseReservation(options.reservationId)
    }

    // Record the waived billing
    const record: DeploymentBillingRecord = {
      deploymentId,
      userId,
      projectId: options.projectId,
      status: "waived",
      amount: 0,
      outcome,
      targetUrl: options.targetUrl,
      moduleName: options.moduleName,
      deploymentDurationMs: options.durationMs,
      error: options.error,
      metadata: options.metadata,
    }
    billingRecords.set(deploymentId, record)

    return {
      success: true,
      balance: undefined, // No charge, balance unchanged
    }
  }

  // Charge for successful deployment
  return chargeForSuccessfulDeployment(userId, deploymentId, {
    projectId: options.projectId,
    targetUrl: options.targetUrl,
    moduleName: options.moduleName,
    durationMs: options.durationMs,
    reservationId: options.reservationId,
    metadata: options.metadata,
  })
}

/**
 * Get billing record for a deployment
 */
export function getDeploymentBillingRecord(
  deploymentId: string,
): DeploymentBillingRecord | undefined {
  return billingRecords.get(deploymentId)
}

/**
 * Get billing analytics for a user
 */
export function getUserBillingAnalytics(userId: string): DeploymentBillingAnalytics {
  const userRecords = Array.from(billingRecords.values()).filter(
    (r) => r.userId === userId,
  )

  const stats = {
    totalAttempts: userRecords.length,
    successfulCharges: 0,
    failedNoCharge: 0,
    refundsIssued: 0,
    totalCreditsCharged: 0,
    totalCreditsRefunded: 0,
  }

  for (const record of userRecords) {
    switch (record.status) {
      case "charged":
        stats.successfulCharges++
        stats.totalCreditsCharged += record.amount
        break
      case "waived":
        if (record.outcome === "failed" || record.outcome === "cancelled") {
          stats.failedNoCharge++
        }
        break
      case "refunded":
        stats.refundsIssued++
        stats.totalCreditsRefunded += record.amount
        break
    }
  }

  return {
    ...stats,
    netCredits: stats.totalCreditsCharged - stats.totalCreditsRefunded,
    successRate:
      stats.totalAttempts > 0
        ? stats.successfulCharges / stats.totalAttempts
        : 0,
    averageCost:
      stats.successfulCharges > 0
        ? stats.totalCreditsCharged / stats.successfulCharges
        : 0,
  }
}

/**
 * Waive billing for a deployment (e.g., promotional or support)
 */
export async function waiveDeploymentBilling(
  deploymentId: string,
  reason: string,
): Promise<BillingResult> {
  const record = billingRecords.get(deploymentId)

  if (!record) {
    return {
      success: false,
      error: "Deployment billing record not found",
    }
  }

  // Release any active reservation
  if (record.reservationId) {
    await releaseReservation(record.reservationId)
  }

  // Update record
  record.status = "waived"
  record.metadata = {
    ...record.metadata,
    waivedReason: reason,
    waivedAt: new Date().toISOString(),
  }
  billingRecords.set(deploymentId, record)

  return {
    success: true,
  }
}

/**
 * Check if user can afford a deployment
 */
export async function canAffordDeployment(userId: string): Promise<boolean> {
  return hasCredits(userId, CREDIT_COSTS.DEPLOYMENT)
}

/**
 * Get estimated deployment cost
 */
export function getDeploymentCost(): number {
  return CREDIT_COSTS.DEPLOYMENT
}

/**
 * Cleanup expired reservations (should be called periodically)
 */
export function cleanupExpiredReservations(): number {
  const now = new Date()
  let cleaned = 0

  const entries = Array.from(reservations.entries())
  for (const [id, reservation] of entries) {
    if (reservation.active && reservation.expiresAt < now) {
      reservation.active = false
      reservations.set(id, reservation)
      cleaned++
    }
  }

  return cleaned
}
