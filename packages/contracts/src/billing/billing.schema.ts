import { z } from 'zod';

export const billingHistoryQuerySchema = z.strictObject({
    cursor: z.string().regex(/^\w+$/u).max(255).optional(),
});
export type TBillingHistoryQuery = z.infer<typeof billingHistoryQuerySchema>;

export type TSubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAYMENT_OVERDUE' | 'PAUSED' | 'ENDED';

export interface IBillingOffer {
    isEnabled: boolean;
}

export interface IBillingSummary extends IBillingOffer {
    plan: 'FREE' | 'PRO';
    status: TSubscriptionStatus | null;
    periodStart: string | null;
    periodEnd: string | null;
    paidThrough: string | null;
    cancelAtPeriodEnd: boolean;
    hasCustomer: boolean;
    hasCheckout: boolean;
    usage: {
        administeredClubs: number;
        clubs: { id: string; name: string; members: number }[];
    };
}

export interface IBillingRedirect {
    url: string;
}

export interface IBillingInvoice {
    id: string;
    amount: number;
    currency: string;
    status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
    createdAt: string;
    documentUrl: string | null;
}

export interface IBillingHistory {
    invoices: IBillingInvoice[];
    nextCursor: string | null;
}
