import { NextResponse } from 'next/server';

export function middleware(request) {
  const url = request.nextUrl.clone();
  url.pathname = url.pathname.replace(/^\/old(?=\/|$)/, '/new');
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/old', '/old/:path*'],
};
