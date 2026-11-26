import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/old/")) {
    const newPathname = "/new/" + pathname.slice("/old/".length);
    const url = request.nextUrl.clone();
    url.pathname = newPathname;
    url.search = search;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/old/:path*",
};
