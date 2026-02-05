/**
 * Workspace Billing Management
 *
 * Manage shared subscriptions at the workspace level with per-member usage tracking.
 */

// ============================================================================
// Types
// ============================================================================

export type SubscriptionPlan = 'free' | 'starter' | 'team' | 'business' | 'enterprise';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused';
export type BillingInterval = 'monthly' | 'yearly';
export type PaymentMethod = 'card' | 'bank_transfer' | 'invoice';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: Date;
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  allowMemberInvites: boolean;
  requireApprovalForProjects: boolean;
  defaultMemberRole: MemberRole;
  usageLimitsEnabled: boolean;
  notifyOnUsageThreshold: number; // percentage
}

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer' | 'billing_admin';

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: MemberRole;
  email: string;
  name: string;
  avatarUrl?: string;
  joinedAt: Date;
  lastActiveAt?: Date;
  usageLimit?: number; // Optional per-member limit
  isActive: boolean;
}

export interface Subscription {
  id: string;
  workspaceId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  quantity: number; // Number of seats
  pricePerSeat: number;
  discount?: SubscriptionDiscount;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionDiscount {
  id: string;
  name: string;
  percentOff?: number;
  amountOff?: number;
  validUntil?: Date;
}

export interface PlanDetails {
  id: SubscriptionPlan;
  name: string;
  description: string;
  features: string[];
  limits: PlanLimits;
  pricing: PlanPricing;
  recommended?: boolean;
}

export interface PlanLimits {
  members: number;
  projects: number;
  creditsPerMonth: number;
  storageGb: number;
  apiCallsPerDay: number;
  customDomains: number;
  advancedFeatures: boolean;
  prioritySupport: boolean;
  sso: boolean;
  auditLog: boolean;
}

export interface PlanPricing {
  monthly: number;
  yearly: number;
  perSeatMonthly?: number;
  perSeatYearly?: number;
}

export interface MemberUsage {
  memberId: string;
  periodStart: Date;
  periodEnd: Date;
  creditsUsed: number;
  apiCalls: number;
  storageUsedMb: number;
  projectsCreated: number;
  deploymentsCount: number;
  lastActivity?: Date;
}

export interface WorkspaceUsage {
  workspaceId: string;
  periodStart: Date;
  periodEnd: Date;
  totalCreditsUsed: number;
  totalCreditsLimit: number;
  totalApiCalls: number;
  totalStorageUsedMb: number;
  activeMembers: number;
  totalMembers: number;
  projectsCount: number;
  memberUsage: MemberUsage[];
}

export interface Invoice {
  id: string;
  workspaceId: string;
  subscriptionId: string;
  number: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  paidAt?: Date;
  hostedUrl?: string;
  pdfUrl?: string;
  lineItems: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface PaymentMethodInfo {
  id: string;
  type: PaymentMethod;
  isDefault: boolean;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  bankAccount?: {
    bankName: string;
    last4: string;
  };
}

export interface BillingAlert {
  id: string;
  workspaceId: string;
  type: 'usage_threshold' | 'payment_failed' | 'subscription_expiring' | 'overage';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

// ============================================================================
// Plan Configuration
// ============================================================================

export const PLANS: Record<SubscriptionPlan, PlanDetails> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'For individuals getting started',
    features: [
      '1 team member',
      '3 projects',
      '100 credits/month',
      '1 GB storage',
      'Community support',
    ],
    limits: {
      members: 1,
      projects: 3,
      creditsPerMonth: 100,
      storageGb: 1,
      apiCallsPerDay: 100,
      customDomains: 0,
      advancedFeatures: false,
      prioritySupport: false,
      sso: false,
      auditLog: false,
    },
    pricing: {
      monthly: 0,
      yearly: 0,
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'For small teams and projects',
    features: [
      '5 team members',
      '10 projects',
      '1,000 credits/month',
      '10 GB storage',
      '1 custom domain',
      'Email support',
    ],
    limits: {
      members: 5,
      projects: 10,
      creditsPerMonth: 1000,
      storageGb: 10,
      apiCallsPerDay: 1000,
      customDomains: 1,
      advancedFeatures: false,
      prioritySupport: false,
      sso: false,
      auditLog: false,
    },
    pricing: {
      monthly: 19,
      yearly: 190,
      perSeatMonthly: 9,
      perSeatYearly: 90,
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    description: 'For growing teams',
    recommended: true,
    features: [
      '20 team members',
      'Unlimited projects',
      '5,000 credits/month',
      '50 GB storage',
      '5 custom domains',
      'Priority support',
      'Advanced analytics',
    ],
    limits: {
      members: 20,
      projects: -1, // Unlimited
      creditsPerMonth: 5000,
      storageGb: 50,
      apiCallsPerDay: 5000,
      customDomains: 5,
      advancedFeatures: true,
      prioritySupport: true,
      sso: false,
      auditLog: false,
    },
    pricing: {
      monthly: 49,
      yearly: 490,
      perSeatMonthly: 15,
      perSeatYearly: 150,
    },
  },
  business: {
    id: 'business',
    name: 'Business',
    description: 'For larger organizations',
    features: [
      '50 team members',
      'Unlimited projects',
      '20,000 credits/month',
      '200 GB storage',
      'Unlimited custom domains',
      'Priority support',
      'SSO integration',
      'Audit log',
      'Advanced security',
    ],
    limits: {
      members: 50,
      projects: -1,
      creditsPerMonth: 20000,
      storageGb: 200,
      apiCallsPerDay: 20000,
      customDomains: -1,
      advancedFeatures: true,
      prioritySupport: true,
      sso: true,
      auditLog: true,
    },
    pricing: {
      monthly: 149,
      yearly: 1490,
      perSeatMonthly: 25,
      perSeatYearly: 250,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large enterprises with custom needs',
    features: [
      'Unlimited team members',
      'Unlimited projects',
      'Unlimited credits',
      'Unlimited storage',
      'Unlimited custom domains',
      'Dedicated support',
      'SSO integration',
      'Advanced audit log',
      'Custom integrations',
      'SLA guarantee',
      'On-premise option',
    ],
    limits: {
      members: -1,
      projects: -1,
      creditsPerMonth: -1,
      storageGb: -1,
      apiCallsPerDay: -1,
      customDomains: -1,
      advancedFeatures: true,
      prioritySupport: true,
      sso: true,
      auditLog: true,
    },
    pricing: {
      monthly: 499,
      yearly: 4990,
    },
  },
};

// ============================================================================
// Workspace Billing Manager
// ============================================================================

export class WorkspaceBillingManager {
  private workspaces: Map<string, Workspace> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private members: Map<string, WorkspaceMember[]> = new Map();
  private usage: Map<string, MemberUsage[]> = new Map();
  private invoices: Map<string, Invoice[]> = new Map();
  private alerts: Map<string, BillingAlert[]> = new Map();
  private paymentMethods: Map<string, PaymentMethodInfo[]> = new Map();

  /**
   * Create a new workspace with subscription
   */
  createWorkspace(
    workspace: Omit<Workspace, 'createdAt'>,
    ownerMember: Omit<WorkspaceMember, 'id' | 'workspaceId' | 'joinedAt' | 'isActive'>
  ): { workspace: Workspace; subscription: Subscription; member: WorkspaceMember } {
    const now = new Date();

    const newWorkspace: Workspace = {
      ...workspace,
      createdAt: now,
    };

    // Create free subscription by default
    const subscription: Subscription = {
      id: `sub_${Date.now()}`,
      workspaceId: workspace.id,
      plan: 'free',
      status: 'active',
      billingInterval: 'monthly',
      currentPeriodStart: now,
      currentPeriodEnd: this.addMonths(now, 1),
      cancelAtPeriodEnd: false,
      quantity: 1,
      pricePerSeat: 0,
    };

    const member: WorkspaceMember = {
      ...ownerMember,
      id: `member_${Date.now()}`,
      workspaceId: workspace.id,
      joinedAt: now,
      isActive: true,
    };

    this.workspaces.set(workspace.id, newWorkspace);
    this.subscriptions.set(workspace.id, subscription);
    this.members.set(workspace.id, [member]);
    this.usage.set(workspace.id, []);
    this.invoices.set(workspace.id, []);
    this.alerts.set(workspace.id, []);

    return { workspace: newWorkspace, subscription, member };
  }

  /**
   * Get workspace subscription
   */
  getSubscription(workspaceId: string): Subscription | undefined {
    return this.subscriptions.get(workspaceId);
  }

  /**
   * Upgrade or change subscription plan
   */
  changePlan(
    workspaceId: string,
    newPlan: SubscriptionPlan,
    interval: BillingInterval = 'monthly'
  ): Subscription | null {
    const subscription = this.subscriptions.get(workspaceId);
    if (!subscription) return null;

    const plan = PLANS[newPlan];
    const members = this.members.get(workspaceId) || [];

    // Check member limit
    if (plan.limits.members !== -1 && members.length > plan.limits.members) {
      throw new Error(`Plan ${newPlan} only allows ${plan.limits.members} members. Current: ${members.length}`);
    }

    const now = new Date();
    const pricing = interval === 'yearly' ? plan.pricing.yearly : plan.pricing.monthly;

    const updatedSubscription: Subscription = {
      ...subscription,
      plan: newPlan,
      billingInterval: interval,
      currentPeriodStart: now,
      currentPeriodEnd: interval === 'yearly' ? this.addYears(now, 1) : this.addMonths(now, 1),
      pricePerSeat: interval === 'yearly'
        ? (plan.pricing.perSeatYearly || 0)
        : (plan.pricing.perSeatMonthly || 0),
      quantity: members.length,
    };

    this.subscriptions.set(workspaceId, updatedSubscription);

    // Generate invoice for plan change
    if (newPlan !== 'free') {
      this.generateInvoice(workspaceId, updatedSubscription);
    }

    return updatedSubscription;
  }

  /**
   * Cancel subscription
   */
  cancelSubscription(workspaceId: string, atPeriodEnd: boolean = true): Subscription | null {
    const subscription = this.subscriptions.get(workspaceId);
    if (!subscription) return null;

    if (atPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
    } else {
      subscription.status = 'canceled';
      subscription.plan = 'free';
    }

    this.subscriptions.set(workspaceId, subscription);
    return subscription;
  }

  /**
   * Add member to workspace
   */
  addMember(
    workspaceId: string,
    member: Omit<WorkspaceMember, 'id' | 'workspaceId' | 'joinedAt' | 'isActive'>
  ): WorkspaceMember | null {
    const subscription = this.subscriptions.get(workspaceId);
    const members = this.members.get(workspaceId);
    if (!subscription || !members) return null;

    const plan = PLANS[subscription.plan];

    // Check member limit
    if (plan.limits.members !== -1 && members.length >= plan.limits.members) {
      throw new Error(`Member limit reached for plan ${subscription.plan}`);
    }

    const newMember: WorkspaceMember = {
      ...member,
      id: `member_${Date.now()}`,
      workspaceId,
      joinedAt: new Date(),
      isActive: true,
    };

    members.push(newMember);
    this.members.set(workspaceId, members);

    // Update subscription quantity
    subscription.quantity = members.length;
    this.subscriptions.set(workspaceId, subscription);

    return newMember;
  }

  /**
   * Remove member from workspace
   */
  removeMember(workspaceId: string, memberId: string): boolean {
    const members = this.members.get(workspaceId);
    if (!members) return false;

    const index = members.findIndex((m) => m.id === memberId);
    if (index === -1) return false;

    // Don't allow removing the owner
    if (members[index].role === 'owner') {
      throw new Error('Cannot remove workspace owner');
    }

    members.splice(index, 1);
    this.members.set(workspaceId, members);

    // Update subscription quantity
    const subscription = this.subscriptions.get(workspaceId);
    if (subscription) {
      subscription.quantity = members.length;
      this.subscriptions.set(workspaceId, subscription);
    }

    return true;
  }

  /**
   * Get workspace members
   */
  getMembers(workspaceId: string): WorkspaceMember[] {
    return this.members.get(workspaceId) || [];
  }

  /**
   * Record member usage
   */
  recordUsage(
    workspaceId: string,
    memberId: string,
    usage: Partial<Omit<MemberUsage, 'memberId' | 'periodStart' | 'periodEnd'>>
  ): MemberUsage | null {
    const subscription = this.subscriptions.get(workspaceId);
    if (!subscription) return null;

    const workspaceUsage = this.usage.get(workspaceId) || [];

    // Find or create current period usage
    let memberUsage = workspaceUsage.find(
      (u) =>
        u.memberId === memberId &&
        u.periodStart <= new Date() &&
        u.periodEnd >= new Date()
    );

    if (!memberUsage) {
      memberUsage = {
        memberId,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        creditsUsed: 0,
        apiCalls: 0,
        storageUsedMb: 0,
        projectsCreated: 0,
        deploymentsCount: 0,
      };
      workspaceUsage.push(memberUsage);
    }

    // Update usage
    if (usage.creditsUsed) memberUsage.creditsUsed += usage.creditsUsed;
    if (usage.apiCalls) memberUsage.apiCalls += usage.apiCalls;
    if (usage.storageUsedMb) memberUsage.storageUsedMb = usage.storageUsedMb;
    if (usage.projectsCreated) memberUsage.projectsCreated += usage.projectsCreated;
    if (usage.deploymentsCount) memberUsage.deploymentsCount += usage.deploymentsCount;
    memberUsage.lastActivity = new Date();

    this.usage.set(workspaceId, workspaceUsage);

    // Check for usage alerts
    this.checkUsageAlerts(workspaceId);

    return memberUsage;
  }

  /**
   * Get workspace usage summary
   */
  getWorkspaceUsage(workspaceId: string): WorkspaceUsage | null {
    const subscription = this.subscriptions.get(workspaceId);
    const members = this.members.get(workspaceId);
    const usageRecords = this.usage.get(workspaceId);

    if (!subscription || !members) return null;

    const plan = PLANS[subscription.plan];

    // Get current period usage
    const currentPeriodUsage = (usageRecords || []).filter(
      (u) =>
        u.periodStart >= subscription.currentPeriodStart &&
        u.periodEnd <= subscription.currentPeriodEnd
    );

    const totalCreditsUsed = currentPeriodUsage.reduce((sum, u) => sum + u.creditsUsed, 0);
    const totalApiCalls = currentPeriodUsage.reduce((sum, u) => sum + u.apiCalls, 0);
    const totalStorageUsedMb = currentPeriodUsage.reduce((sum, u) => sum + u.storageUsedMb, 0);

    const activeMembers = currentPeriodUsage.filter(
      (u) => u.lastActivity && Date.now() - u.lastActivity.getTime() < 7 * 24 * 60 * 60 * 1000
    ).length;

    return {
      workspaceId,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      totalCreditsUsed,
      totalCreditsLimit: plan.limits.creditsPerMonth,
      totalApiCalls,
      totalStorageUsedMb,
      activeMembers,
      totalMembers: members.length,
      projectsCount: currentPeriodUsage.reduce((sum, u) => sum + u.projectsCreated, 0),
      memberUsage: currentPeriodUsage,
    };
  }

  /**
   * Get invoices for workspace
   */
  getInvoices(workspaceId: string): Invoice[] {
    return this.invoices.get(workspaceId) || [];
  }

  /**
   * Get billing alerts
   */
  getAlerts(workspaceId: string): BillingAlert[] {
    return (this.alerts.get(workspaceId) || []).filter((a) => !a.acknowledged);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(workspaceId: string, alertId: string, userId: string): boolean {
    const alerts = this.alerts.get(workspaceId);
    if (!alerts) return false;

    const alert = alerts.find((a) => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    return true;
  }

  /**
   * Add payment method
   */
  addPaymentMethod(workspaceId: string, method: Omit<PaymentMethodInfo, 'id'>): PaymentMethodInfo {
    const methods = this.paymentMethods.get(workspaceId) || [];

    const newMethod: PaymentMethodInfo = {
      ...method,
      id: `pm_${Date.now()}`,
    };

    // If this is the first method or marked as default, update others
    if (method.isDefault || methods.length === 0) {
      methods.forEach((m) => (m.isDefault = false));
      newMethod.isDefault = true;
    }

    methods.push(newMethod);
    this.paymentMethods.set(workspaceId, methods);

    return newMethod;
  }

  /**
   * Get payment methods
   */
  getPaymentMethods(workspaceId: string): PaymentMethodInfo[] {
    return this.paymentMethods.get(workspaceId) || [];
  }

  /**
   * Check if workspace can perform action based on limits
   */
  checkLimit(
    workspaceId: string,
    limitType: keyof PlanLimits,
    currentValue: number
  ): { allowed: boolean; limit: number; remaining: number } {
    const subscription = this.subscriptions.get(workspaceId);
    if (!subscription) {
      return { allowed: false, limit: 0, remaining: 0 };
    }

    const plan = PLANS[subscription.plan];
    const limit = plan.limits[limitType];

    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, limit: -1, remaining: -1 };
    }

    const remaining = Math.max(0, (limit as number) - currentValue);

    return {
      allowed: currentValue < (limit as number),
      limit: limit as number,
      remaining,
    };
  }

  // Private helpers

  private generateInvoice(workspaceId: string, subscription: Subscription): Invoice {
    const plan = PLANS[subscription.plan];
    const basePrice = subscription.billingInterval === 'yearly'
      ? plan.pricing.yearly
      : plan.pricing.monthly;

    const seatPrice = subscription.billingInterval === 'yearly'
      ? (plan.pricing.perSeatYearly || 0)
      : (plan.pricing.perSeatMonthly || 0);

    const lineItems: InvoiceLineItem[] = [
      {
        description: `${plan.name} Plan (${subscription.billingInterval})`,
        quantity: 1,
        unitPrice: basePrice,
        amount: basePrice,
      },
    ];

    if (seatPrice > 0 && subscription.quantity > 1) {
      const additionalSeats = subscription.quantity - 1;
      lineItems.push({
        description: `Additional seats (${additionalSeats})`,
        quantity: additionalSeats,
        unitPrice: seatPrice,
        amount: additionalSeats * seatPrice,
      });
    }

    if (subscription.discount) {
      const discountAmount = subscription.discount.percentOff
        ? lineItems.reduce((sum, i) => sum + i.amount, 0) * (subscription.discount.percentOff / 100)
        : subscription.discount.amountOff || 0;

      lineItems.push({
        description: `Discount: ${subscription.discount.name}`,
        quantity: 1,
        unitPrice: -discountAmount,
        amount: -discountAmount,
      });
    }

    const total = lineItems.reduce((sum, i) => sum + i.amount, 0);

    const invoice: Invoice = {
      id: `inv_${Date.now()}`,
      workspaceId,
      subscriptionId: subscription.id,
      number: `INV-${Date.now()}`,
      status: 'open',
      amount: total,
      currency: 'USD',
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      dueDate: this.addDays(new Date(), 30),
      lineItems,
    };

    const invoices = this.invoices.get(workspaceId) || [];
    invoices.push(invoice);
    this.invoices.set(workspaceId, invoices);

    return invoice;
  }

  private checkUsageAlerts(workspaceId: string): void {
    const workspace = this.workspaces.get(workspaceId);
    const subscription = this.subscriptions.get(workspaceId);
    const usage = this.getWorkspaceUsage(workspaceId);

    if (!workspace || !subscription || !usage) return;

    const plan = PLANS[subscription.plan];
    const alerts = this.alerts.get(workspaceId) || [];

    // Check credits usage
    if (plan.limits.creditsPerMonth !== -1) {
      const usagePercent = (usage.totalCreditsUsed / plan.limits.creditsPerMonth) * 100;
      const threshold = workspace.settings.notifyOnUsageThreshold || 80;

      if (usagePercent >= threshold) {
        const existingAlert = alerts.find(
          (a) => a.type === 'usage_threshold' && !a.acknowledged
        );

        if (!existingAlert) {
          alerts.push({
            id: `alert_${Date.now()}`,
            workspaceId,
            type: 'usage_threshold',
            severity: usagePercent >= 100 ? 'critical' : 'warning',
            message: usagePercent >= 100
              ? `Credit limit reached. Current usage: ${usage.totalCreditsUsed}/${plan.limits.creditsPerMonth}`
              : `${usagePercent.toFixed(0)}% of monthly credits used`,
            createdAt: new Date(),
            acknowledged: false,
          });
        }
      }
    }

    this.alerts.set(workspaceId, alerts);
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  private addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: WorkspaceBillingManager | null = null;

export function getBillingManager(): WorkspaceBillingManager {
  if (!managerInstance) {
    managerInstance = new WorkspaceBillingManager();
  }
  return managerInstance;
}

export default WorkspaceBillingManager;
