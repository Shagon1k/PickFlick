export function buildCheckoutRequest(customerId: string, requestId: string, baseUrl: string) {
    const base = `${baseUrl}/settings?tab=subscription`;
    return {
        customerId,
        requestId,
        successUrl: `${base}&checkout=returned`,
        cancelUrl: `${base}&checkout=cancelled`,
    };
}
