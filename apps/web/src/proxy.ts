import { NextResponse, type NextRequest } from "next/server";

/**
 * Component and shell previews ship in every image because one image is promoted from UAT to
 * production. Production answers them with the ordinary 404 at request time.
 */
export function proxy(request: NextRequest): NextResponse {
  if (process.env.APP_ENV === "production") {
    return NextResponse.rewrite(new URL("/__preview-unavailable", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/ui-preview/:path*", "/shell-preview/:path*"],
};
