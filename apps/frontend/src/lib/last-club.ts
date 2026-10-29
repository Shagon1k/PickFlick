/** The Club `/app` opens first. Set only after the API authorized the visitor's Membership. */
export const LAST_CLUB_COOKIE = 'pickflick.last_club';

export const LAST_CLUB_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
} as const;
