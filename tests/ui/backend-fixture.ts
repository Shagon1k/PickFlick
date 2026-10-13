import { type BrowserContext, expect } from '@playwright/test';

export interface IBackendFixture {
    clubId: string;
    sessionId: string | null;
    admin: string;
    member: string;
    outsider: string;
    memberMembershipId: string;
}
export async function seedFixture(
    context: BrowserContext,
    session = false,
): Promise<IBackendFixture> {
    const response = await context.request.post('/api/_test/fixtures', { data: { session } });
    expect(response.status()).toBe(200);
    return (await response.json()) as IBackendFixture;
}
export async function signIn(context: BrowserContext, userId: string) {
    const response = await context.request.post(`/api/_test/login/${userId}`);
    expect(response.status()).toBe(204);
}
