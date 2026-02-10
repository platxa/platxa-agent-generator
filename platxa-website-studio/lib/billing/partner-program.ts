/**
 * Partner Program & Whitelabel System
 *
 * Enables agencies and partners to resell Platxa with custom branding.
 * Supports multi-tier partnership levels, commission tracking, and
 * complete whitelabel customization.
 *
 * Key Features:
 * - Partner tiers (Starter, Professional, Enterprise)
 * - Custom branding (logo, colors, domain)
 * - Revenue sharing and commission tracking
 * - Client management under partner accounts
 * - Usage analytics per partner
 *
 * @example
 * ```typescript
 * import { PartnerProgram, createPartner, getPartnerDashboard } from "@/lib/billing/partner-program"
 *
 * // Register a new partner
 * const partner = await createPartner({
 *   name: "Acme Agency",
 *   email: "contact@acme.com",
 *   tier: "professional",
 *   branding: {
 *     companyName: "Acme Themes",
 *     primaryColor: "#2563eb",
 *   },
 * })
 *
 * // Get partner dashboard
 * const dashboard = await getPartnerDashboard(partner.id)
 * ```
 *
 * @module billing/partner-program
 */

// =============================================================================
// Types
// =============================================================================

/** Partner tier levels */
export type PartnerTier = "starter" | "professional" | "enterprise"

/** Partner status */
export type PartnerStatus = "pending" | "active" | "suspended" | "terminated"

/** Commission type */
export type CommissionType = "percentage" | "fixed" | "tiered"

/** Payout status */
export type PayoutStatus = "pending" | "processing" | "completed" | "failed"

/** Whitelabel branding configuration */
export interface WhitelabelBranding {
  /** Custom company name */
  companyName: string
  /** Logo URL */
  logoUrl?: string
  /** Logo URL for dark mode */
  logoDarkUrl?: string
  /** Favicon URL */
  faviconUrl?: string
  /** Primary brand color */
  primaryColor: string
  /** Secondary brand color */
  secondaryColor?: string
  /** Accent color */
  accentColor?: string
  /** Custom CSS overrides */
  customCss?: string
  /** Custom domain */
  customDomain?: string
  /** Email from name */
  emailFromName?: string
  /** Email from address (must be verified) */
  emailFromAddress?: string
  /** Support email */
  supportEmail?: string
  /** Support URL */
  supportUrl?: string
  /** Terms of service URL */
  termsUrl?: string
  /** Privacy policy URL */
  privacyUrl?: string
  /** Hide "Powered by Platxa" badge */
  hidePoweredBy: boolean
  /** Custom footer text */
  footerText?: string
}

/** Partner tier configuration */
export interface PartnerTierConfig {
  tier: PartnerTier
  name: string
  description: string
  /** Monthly fee */
  monthlyFee: number
  /** Minimum monthly commitment */
  minMonthlyRevenue?: number
  /** Commission percentage (0-100) */
  commissionRate: number
  /** Maximum number of clients */
  maxClients: number | "unlimited"
  /** Maximum number of team members */
  maxTeamMembers: number
  /** Whitelabel features available */
  whitelabelFeatures: WhitelabelFeatures
  /** Support level */
  supportLevel: "standard" | "priority" | "dedicated"
  /** API access level */
  apiAccess: "basic" | "full" | "unlimited"
  /** Custom domain allowed */
  customDomainAllowed: boolean
  /** SSO for clients allowed */
  clientSSOAllowed: boolean
  /** Analytics access */
  analyticsAccess: "basic" | "advanced" | "full"
}

/** Whitelabel features by tier */
export interface WhitelabelFeatures {
  /** Custom logo */
  customLogo: boolean
  /** Custom colors */
  customColors: boolean
  /** Custom domain */
  customDomain: boolean
  /** Custom email templates */
  customEmailTemplates: boolean
  /** Remove Platxa branding */
  removeBranding: boolean
  /** Custom CSS */
  customCss: boolean
  /** Custom login page */
  customLoginPage: boolean
  /** White-labeled API */
  whitelabelApi: boolean
}

/** Partner account */
export interface Partner {
  /** Unique partner ID */
  id: string
  /** Partner company name */
  name: string
  /** Primary contact email */
  email: string
  /** Partner tier */
  tier: PartnerTier
  /** Partner status */
  status: PartnerStatus
  /** Whitelabel branding */
  branding: WhitelabelBranding
  /** Commission configuration */
  commission: CommissionConfig
  /** Billing information */
  billing: PartnerBilling
  /** Partner settings */
  settings: PartnerSettings
  /** Created timestamp */
  createdAt: Date
  /** Updated timestamp */
  updatedAt: Date
  /** Activated timestamp */
  activatedAt?: Date
  /** Account manager (for enterprise) */
  accountManager?: string
}

/** Commission configuration */
export interface CommissionConfig {
  /** Commission type */
  type: CommissionType
  /** Rate (percentage or fixed amount) */
  rate: number
  /** Tiered rates (if type is 'tiered') */
  tiers?: CommissionTier[]
  /** Minimum payout threshold */
  minPayoutThreshold: number
  /** Payout frequency */
  payoutFrequency: "monthly" | "quarterly"
  /** Currency */
  currency: string
}

/** Commission tier for tiered commissions */
export interface CommissionTier {
  /** Minimum revenue to reach this tier */
  minRevenue: number
  /** Commission rate for this tier */
  rate: number
}

/** Partner billing information */
export interface PartnerBilling {
  /** Billing email */
  billingEmail: string
  /** Company name for invoices */
  companyName: string
  /** Tax ID / VAT number */
  taxId?: string
  /** Billing address */
  address: BillingAddress
  /** Payment method ID */
  paymentMethodId?: string
  /** Payout method (for commissions) */
  payoutMethod?: PayoutMethod
}

/** Billing address */
export interface BillingAddress {
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode: string
  country: string
}

/** Payout method */
export interface PayoutMethod {
  type: "bank_transfer" | "paypal" | "stripe"
  details: Record<string, string>
}

/** Partner settings */
export interface PartnerSettings {
  /** Notify on new client signup */
  notifyOnClientSignup: boolean
  /** Notify on commission earned */
  notifyOnCommission: boolean
  /** Weekly digest email */
  weeklyDigest: boolean
  /** Client can see Platxa branding */
  allowPlatxaBranding: boolean
  /** Auto-approve new clients */
  autoApproveClients: boolean
  /** Default client plan */
  defaultClientPlan?: string
}

/** Partner client (end customer) */
export interface PartnerClient {
  /** Client ID */
  id: string
  /** Partner ID */
  partnerId: string
  /** Client company name */
  name: string
  /** Client email */
  email: string
  /** Subscription plan */
  plan: string
  /** Monthly recurring revenue */
  mrr: number
  /** Status */
  status: "active" | "churned" | "paused"
  /** Created timestamp */
  createdAt: Date
  /** Last active timestamp */
  lastActiveAt?: Date
}

/** Commission record */
export interface CommissionRecord {
  /** Record ID */
  id: string
  /** Partner ID */
  partnerId: string
  /** Client ID */
  clientId: string
  /** Transaction ID (from billing) */
  transactionId: string
  /** Gross amount */
  grossAmount: number
  /** Commission amount */
  commissionAmount: number
  /** Commission rate applied */
  rateApplied: number
  /** Currency */
  currency: string
  /** Period */
  period: string
  /** Status */
  status: "pending" | "approved" | "paid"
  /** Created timestamp */
  createdAt: Date
}

/** Payout record */
export interface PayoutRecord {
  /** Payout ID */
  id: string
  /** Partner ID */
  partnerId: string
  /** Amount */
  amount: number
  /** Currency */
  currency: string
  /** Commission records included */
  commissionIds: string[]
  /** Status */
  status: PayoutStatus
  /** Payout method used */
  payoutMethod: PayoutMethod
  /** External reference (bank transfer ID, etc.) */
  externalReference?: string
  /** Created timestamp */
  createdAt: Date
  /** Processed timestamp */
  processedAt?: Date
  /** Completed timestamp */
  completedAt?: Date
}

/** Partner dashboard data */
export interface PartnerDashboard {
  /** Partner info */
  partner: Partner
  /** Current month stats */
  currentMonth: MonthlyStats
  /** Previous month stats */
  previousMonth: MonthlyStats
  /** All-time stats */
  allTime: AllTimeStats
  /** Recent clients */
  recentClients: PartnerClient[]
  /** Pending commissions */
  pendingCommissions: number
  /** Next payout date */
  nextPayoutDate?: Date
  /** Next payout amount (estimate) */
  nextPayoutEstimate?: number
  /** Revenue trend (last 12 months) */
  revenueTrend: MonthlyRevenue[]
}

/** Monthly statistics */
export interface MonthlyStats {
  /** Month (YYYY-MM) */
  month: string
  /** New clients */
  newClients: number
  /** Churned clients */
  churnedClients: number
  /** Total active clients */
  totalActiveClients: number
  /** Gross revenue */
  grossRevenue: number
  /** Commission earned */
  commissionEarned: number
  /** Theme deployments */
  themeDeployments: number
}

/** All-time statistics */
export interface AllTimeStats {
  /** Total clients ever */
  totalClients: number
  /** Current active clients */
  activeClients: number
  /** Total revenue generated */
  totalRevenue: number
  /** Total commissions earned */
  totalCommissions: number
  /** Total commissions paid */
  totalPaid: number
  /** Partner since date */
  partnerSince: Date
}

/** Monthly revenue for trend */
export interface MonthlyRevenue {
  month: string
  revenue: number
  commission: number
  clients: number
}

/** Partner creation input */
export interface CreatePartnerInput {
  name: string
  email: string
  tier: PartnerTier
  branding?: Partial<WhitelabelBranding>
  billing: {
    billingEmail: string
    companyName: string
    taxId?: string
    address: BillingAddress
  }
  settings?: Partial<PartnerSettings>
}

/** Partner update input */
export interface UpdatePartnerInput {
  name?: string
  email?: string
  branding?: Partial<WhitelabelBranding>
  settings?: Partial<PartnerSettings>
}

// =============================================================================
// Constants
// =============================================================================

/** Partner tier configurations */
export const PARTNER_TIERS: Record<PartnerTier, PartnerTierConfig> = {
  starter: {
    tier: "starter",
    name: "Starter Partner",
    description: "Perfect for freelancers and small agencies",
    monthlyFee: 99,
    commissionRate: 15,
    maxClients: 10,
    maxTeamMembers: 2,
    whitelabelFeatures: {
      customLogo: true,
      customColors: true,
      customDomain: false,
      customEmailTemplates: false,
      removeBranding: false,
      customCss: false,
      customLoginPage: false,
      whitelabelApi: false,
    },
    supportLevel: "standard",
    apiAccess: "basic",
    customDomainAllowed: false,
    clientSSOAllowed: false,
    analyticsAccess: "basic",
  },
  professional: {
    tier: "professional",
    name: "Professional Partner",
    description: "For growing agencies with multiple clients",
    monthlyFee: 299,
    minMonthlyRevenue: 1000,
    commissionRate: 25,
    maxClients: 50,
    maxTeamMembers: 10,
    whitelabelFeatures: {
      customLogo: true,
      customColors: true,
      customDomain: true,
      customEmailTemplates: true,
      removeBranding: true,
      customCss: true,
      customLoginPage: false,
      whitelabelApi: false,
    },
    supportLevel: "priority",
    apiAccess: "full",
    customDomainAllowed: true,
    clientSSOAllowed: false,
    analyticsAccess: "advanced",
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise Partner",
    description: "Full whitelabel solution for large agencies",
    monthlyFee: 999,
    minMonthlyRevenue: 5000,
    commissionRate: 35,
    maxClients: "unlimited",
    maxTeamMembers: 50,
    whitelabelFeatures: {
      customLogo: true,
      customColors: true,
      customDomain: true,
      customEmailTemplates: true,
      removeBranding: true,
      customCss: true,
      customLoginPage: true,
      whitelabelApi: true,
    },
    supportLevel: "dedicated",
    apiAccess: "unlimited",
    customDomainAllowed: true,
    clientSSOAllowed: true,
    analyticsAccess: "full",
  },
}

/** Default branding configuration */
const DEFAULT_BRANDING: WhitelabelBranding = {
  companyName: "",
  primaryColor: "#2563eb",
  hidePoweredBy: false,
}

/** Default partner settings */
const DEFAULT_SETTINGS: PartnerSettings = {
  notifyOnClientSignup: true,
  notifyOnCommission: true,
  weeklyDigest: true,
  allowPlatxaBranding: true,
  autoApproveClients: false,
}

/** Default commission config */
const DEFAULT_COMMISSION: Omit<CommissionConfig, "rate"> = {
  type: "percentage",
  minPayoutThreshold: 100,
  payoutFrequency: "monthly",
  currency: "USD",
}

// =============================================================================
// Partner Program Class
// =============================================================================

export class PartnerProgram {
  private partners: Map<string, Partner> = new Map()
  private clients: Map<string, PartnerClient> = new Map()
  private commissions: Map<string, CommissionRecord> = new Map()
  private payouts: Map<string, PayoutRecord> = new Map()

  /**
   * Create a new partner account
   */
  async createPartner(input: CreatePartnerInput): Promise<Partner> {
    const id = generatePartnerId()
    const now = new Date()
    const tierConfig = PARTNER_TIERS[input.tier]

    const partner: Partner = {
      id,
      name: input.name,
      email: input.email,
      tier: input.tier,
      status: "pending",
      branding: {
        ...DEFAULT_BRANDING,
        companyName: input.branding?.companyName || input.name,
        ...input.branding,
      },
      commission: {
        ...DEFAULT_COMMISSION,
        rate: tierConfig.commissionRate,
      },
      billing: {
        billingEmail: input.billing.billingEmail,
        companyName: input.billing.companyName,
        taxId: input.billing.taxId,
        address: input.billing.address,
      },
      settings: {
        ...DEFAULT_SETTINGS,
        ...input.settings,
      },
      createdAt: now,
      updatedAt: now,
    }

    this.partners.set(id, partner)
    return partner
  }

  /**
   * Activate a partner account
   */
  async activatePartner(partnerId: string): Promise<Partner> {
    const partner = this.partners.get(partnerId)
    if (!partner) {
      throw new Error(`Partner not found: ${partnerId}`)
    }

    partner.status = "active"
    partner.activatedAt = new Date()
    partner.updatedAt = new Date()
    this.partners.set(partnerId, partner)

    return partner
  }

  /**
   * Update partner information
   */
  async updatePartner(partnerId: string, input: UpdatePartnerInput): Promise<Partner> {
    const partner = this.partners.get(partnerId)
    if (!partner) {
      throw new Error(`Partner not found: ${partnerId}`)
    }

    if (input.name) partner.name = input.name
    if (input.email) partner.email = input.email
    if (input.branding) {
      partner.branding = { ...partner.branding, ...input.branding }
    }
    if (input.settings) {
      partner.settings = { ...partner.settings, ...input.settings }
    }
    partner.updatedAt = new Date()

    this.partners.set(partnerId, partner)
    return partner
  }

  /**
   * Upgrade partner tier
   */
  async upgradeTier(partnerId: string, newTier: PartnerTier): Promise<Partner> {
    const partner = this.partners.get(partnerId)
    if (!partner) {
      throw new Error(`Partner not found: ${partnerId}`)
    }

    const currentTierIndex = ["starter", "professional", "enterprise"].indexOf(partner.tier)
    const newTierIndex = ["starter", "professional", "enterprise"].indexOf(newTier)

    if (newTierIndex <= currentTierIndex) {
      throw new Error("Can only upgrade to a higher tier")
    }

    const newTierConfig = PARTNER_TIERS[newTier]
    partner.tier = newTier
    partner.commission.rate = newTierConfig.commissionRate
    partner.updatedAt = new Date()

    this.partners.set(partnerId, partner)
    return partner
  }

  /**
   * Get partner by ID
   */
  getPartner(partnerId: string): Partner | undefined {
    return this.partners.get(partnerId)
  }

  /**
   * Get partner by custom domain
   */
  getPartnerByDomain(domain: string): Partner | undefined {
    return Array.from(this.partners.values()).find(
      (p) => p.branding.customDomain?.toLowerCase() === domain.toLowerCase()
    )
  }

  /**
   * Add a client under a partner
   */
  async addClient(
    partnerId: string,
    clientData: { name: string; email: string; plan: string; mrr: number }
  ): Promise<PartnerClient> {
    const partner = this.partners.get(partnerId)
    if (!partner) {
      throw new Error(`Partner not found: ${partnerId}`)
    }

    // Check client limit
    const tierConfig = PARTNER_TIERS[partner.tier]
    const currentClients = this.getPartnerClients(partnerId).filter(
      (c) => c.status === "active"
    ).length

    if (tierConfig.maxClients !== "unlimited" && currentClients >= tierConfig.maxClients) {
      throw new Error(`Partner has reached maximum client limit (${tierConfig.maxClients})`)
    }

    const client: PartnerClient = {
      id: generateClientId(),
      partnerId,
      name: clientData.name,
      email: clientData.email,
      plan: clientData.plan,
      mrr: clientData.mrr,
      status: "active",
      createdAt: new Date(),
    }

    this.clients.set(client.id, client)
    return client
  }

  /**
   * Get all clients for a partner
   */
  getPartnerClients(partnerId: string): PartnerClient[] {
    return Array.from(this.clients.values()).filter((c) => c.partnerId === partnerId)
  }

  /**
   * Record a commission
   */
  async recordCommission(
    partnerId: string,
    clientId: string,
    transactionId: string,
    grossAmount: number
  ): Promise<CommissionRecord> {
    const partner = this.partners.get(partnerId)
    if (!partner) {
      throw new Error(`Partner not found: ${partnerId}`)
    }

    const rate = this.calculateCommissionRate(partner, grossAmount)
    const commissionAmount = (grossAmount * rate) / 100

    const record: CommissionRecord = {
      id: generateCommissionId(),
      partnerId,
      clientId,
      transactionId,
      grossAmount,
      commissionAmount,
      rateApplied: rate,
      currency: partner.commission.currency,
      period: formatPeriod(new Date()),
      status: "pending",
      createdAt: new Date(),
    }

    this.commissions.set(record.id, record)
    return record
  }

  /**
   * Get pending commissions for a partner
   */
  getPendingCommissions(partnerId: string): CommissionRecord[] {
    return Array.from(this.commissions.values()).filter(
      (c) => c.partnerId === partnerId && c.status === "pending"
    )
  }

  /**
   * Process payout for a partner
   */
  async processPayout(partnerId: string): Promise<PayoutRecord | null> {
    const partner = this.partners.get(partnerId)
    if (!partner) {
      throw new Error(`Partner not found: ${partnerId}`)
    }

    if (!partner.billing.payoutMethod) {
      throw new Error("Partner has no payout method configured")
    }

    const pendingCommissions = this.getPendingCommissions(partnerId)
    const totalAmount = pendingCommissions.reduce((sum, c) => sum + c.commissionAmount, 0)

    if (totalAmount < partner.commission.minPayoutThreshold) {
      return null // Below threshold
    }

    const payout: PayoutRecord = {
      id: generatePayoutId(),
      partnerId,
      amount: totalAmount,
      currency: partner.commission.currency,
      commissionIds: pendingCommissions.map((c) => c.id),
      status: "pending",
      payoutMethod: partner.billing.payoutMethod,
      createdAt: new Date(),
    }

    // Mark commissions as processing
    for (const commission of pendingCommissions) {
      commission.status = "approved"
      this.commissions.set(commission.id, commission)
    }

    this.payouts.set(payout.id, payout)
    return payout
  }

  /**
   * Get partner dashboard data
   */
  async getDashboard(partnerId: string): Promise<PartnerDashboard> {
    const partner = this.partners.get(partnerId)
    if (!partner) {
      throw new Error(`Partner not found: ${partnerId}`)
    }

    const clients = this.getPartnerClients(partnerId)
    const commissions = Array.from(this.commissions.values()).filter(
      (c) => c.partnerId === partnerId
    )

    const now = new Date()
    const currentMonth = formatPeriod(now)
    const prevMonth = formatPeriod(new Date(now.getFullYear(), now.getMonth() - 1, 1))

    // Calculate current month stats
    const currentMonthCommissions = commissions.filter((c) => c.period === currentMonth)
    const currentMonthClients = clients.filter((c) => formatPeriod(c.createdAt) === currentMonth)

    // Calculate previous month stats
    const prevMonthCommissions = commissions.filter((c) => c.period === prevMonth)

    // Calculate all-time stats
    const totalCommissions = commissions.reduce((sum, c) => sum + c.commissionAmount, 0)
    const totalRevenue = commissions.reduce((sum, c) => sum + c.grossAmount, 0)
    const paidCommissions = commissions
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + c.commissionAmount, 0)

    // Revenue trend (last 12 months)
    const revenueTrend = this.calculateRevenueTrend(partnerId, 12)

    // Pending commissions total
    const pendingTotal = this.getPendingCommissions(partnerId).reduce(
      (sum, c) => sum + c.commissionAmount,
      0
    )

    return {
      partner,
      currentMonth: {
        month: currentMonth,
        newClients: currentMonthClients.length,
        churnedClients: 0, // Would need churn tracking
        totalActiveClients: clients.filter((c) => c.status === "active").length,
        grossRevenue: currentMonthCommissions.reduce((sum, c) => sum + c.grossAmount, 0),
        commissionEarned: currentMonthCommissions.reduce((sum, c) => sum + c.commissionAmount, 0),
        themeDeployments: 0, // Would need deployment tracking
      },
      previousMonth: {
        month: prevMonth,
        newClients: 0,
        churnedClients: 0,
        totalActiveClients: 0,
        grossRevenue: prevMonthCommissions.reduce((sum, c) => sum + c.grossAmount, 0),
        commissionEarned: prevMonthCommissions.reduce((sum, c) => sum + c.commissionAmount, 0),
        themeDeployments: 0,
      },
      allTime: {
        totalClients: clients.length,
        activeClients: clients.filter((c) => c.status === "active").length,
        totalRevenue,
        totalCommissions,
        totalPaid: paidCommissions,
        partnerSince: partner.createdAt,
      },
      recentClients: clients
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5),
      pendingCommissions: pendingTotal,
      nextPayoutDate: this.getNextPayoutDate(partner),
      nextPayoutEstimate: pendingTotal,
      revenueTrend,
    }
  }

  /**
   * Validate branding configuration
   */
  validateBranding(
    branding: Partial<WhitelabelBranding>,
    tier: PartnerTier
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const features = PARTNER_TIERS[tier].whitelabelFeatures

    if (branding.customDomain && !features.customDomain) {
      errors.push("Custom domain is not available in your tier")
    }

    if (branding.hidePoweredBy && !features.removeBranding) {
      errors.push("Removing branding is not available in your tier")
    }

    if (branding.customCss && !features.customCss) {
      errors.push("Custom CSS is not available in your tier")
    }

    if (branding.primaryColor && !isValidColor(branding.primaryColor)) {
      errors.push("Invalid primary color format")
    }

    if (branding.secondaryColor && !isValidColor(branding.secondaryColor)) {
      errors.push("Invalid secondary color format")
    }

    if (branding.customDomain && !isValidDomain(branding.customDomain)) {
      errors.push("Invalid custom domain format")
    }

    if (branding.logoUrl && !isValidUrl(branding.logoUrl)) {
      errors.push("Invalid logo URL")
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Get branding for a domain
   */
  getBrandingForDomain(domain: string): WhitelabelBranding | null {
    const partner = this.getPartnerByDomain(domain)
    return partner?.branding || null
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private calculateCommissionRate(partner: Partner, revenue: number): number {
    if (partner.commission.type === "fixed") {
      return partner.commission.rate
    }

    if (partner.commission.type === "tiered" && partner.commission.tiers) {
      // Find applicable tier based on cumulative revenue
      const sortedTiers = [...partner.commission.tiers].sort(
        (a, b) => b.minRevenue - a.minRevenue
      )
      for (const tier of sortedTiers) {
        if (revenue >= tier.minRevenue) {
          return tier.rate
        }
      }
    }

    return partner.commission.rate
  }

  private calculateRevenueTrend(partnerId: string, months: number): MonthlyRevenue[] {
    const trend: MonthlyRevenue[] = []
    const now = new Date()

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const period = formatPeriod(date)

      const monthCommissions = Array.from(this.commissions.values()).filter(
        (c) => c.partnerId === partnerId && c.period === period
      )

      const monthClients = Array.from(this.clients.values()).filter(
        (c) => c.partnerId === partnerId && formatPeriod(c.createdAt) === period
      )

      trend.push({
        month: period,
        revenue: monthCommissions.reduce((sum, c) => sum + c.grossAmount, 0),
        commission: monthCommissions.reduce((sum, c) => sum + c.commissionAmount, 0),
        clients: monthClients.length,
      })
    }

    return trend
  }

  private getNextPayoutDate(partner: Partner): Date {
    const now = new Date()
    if (partner.commission.payoutFrequency === "monthly") {
      // Next month, first day
      return new Date(now.getFullYear(), now.getMonth() + 1, 1)
    } else {
      // Next quarter
      const quarter = Math.floor(now.getMonth() / 3)
      return new Date(now.getFullYear(), (quarter + 1) * 3, 1)
    }
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

function generatePartnerId(): string {
  return `ptr_${Date.now().toString(36)}_${randomString(8)}`
}

function generateClientId(): string {
  return `pcl_${Date.now().toString(36)}_${randomString(8)}`
}

function generateCommissionId(): string {
  return `com_${Date.now().toString(36)}_${randomString(8)}`
}

function generatePayoutId(): string {
  return `pay_${Date.now().toString(36)}_${randomString(8)}`
}

function randomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function formatPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function isValidColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

function isValidDomain(domain: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(domain)
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let globalProgram: PartnerProgram | null = null

/**
 * Get the global partner program instance
 */
export function getPartnerProgram(): PartnerProgram {
  if (!globalProgram) {
    globalProgram = new PartnerProgram()
  }
  return globalProgram
}

/**
 * Create a new partner program instance
 */
export function createPartnerProgram(): PartnerProgram {
  return new PartnerProgram()
}

/**
 * Create a partner (convenience function)
 */
export async function createPartner(input: CreatePartnerInput): Promise<Partner> {
  return getPartnerProgram().createPartner(input)
}

/**
 * Get partner dashboard (convenience function)
 */
export async function getPartnerDashboard(partnerId: string): Promise<PartnerDashboard> {
  return getPartnerProgram().getDashboard(partnerId)
}

/**
 * Get branding for domain (convenience function)
 */
export function getBrandingForDomain(domain: string): WhitelabelBranding | null {
  return getPartnerProgram().getBrandingForDomain(domain)
}

/**
 * Get partner tier configuration
 */
export function getPartnerTierConfig(tier: PartnerTier): PartnerTierConfig {
  return PARTNER_TIERS[tier]
}

/**
 * Get all partner tiers
 */
export function getAllPartnerTiers(): PartnerTierConfig[] {
  return Object.values(PARTNER_TIERS)
}

export default PartnerProgram
