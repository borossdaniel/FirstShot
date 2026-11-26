import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/old/")) {
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = "/new/" + pathname.slice("/old/".length);
    newUrl.search = search;
    return NextResponse.redirect(newUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/old/:path*",
};
