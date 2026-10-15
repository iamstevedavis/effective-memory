import { NextResponse } from "next/server";
// Never expose legacy public/generated assets outside the owner-authorized media route.
export function middleware() { return new NextResponse(null, { status: 404 }); }
export const config = { matcher: ["/generated/:path*"] };
