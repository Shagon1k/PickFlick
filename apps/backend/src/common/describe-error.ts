/**
 * Log-safe error fields: the class and a machine code (Prisma `P2034`, Node `EADDRINUSE`), never
 * a message, which may hold user data or connection credentials.
 */
export function describeError(error: unknown) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    return {
        errorName: error instanceof Error ? error.name : typeof error,
        ...(typeof code === 'string' ? { errorCode: code } : {}),
    };
}
