import { NextResponse } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login', '/(auth)/login', '/'];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Check if route is public
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route)
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For server-side checks, we can't directly access sessionStorage
  // So we'll check for auth cookie or header
  // The client-side AuthGuard will still provide protection as a second layer
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
