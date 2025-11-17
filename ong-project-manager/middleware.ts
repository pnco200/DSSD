import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Solo usar cookies, no localStorage (que es del cliente)
  const token = request.cookies.get('token')?.value;

  // Rutas que requieren autenticación
  const protectedRoutes = ['/dashboard', '/projects'];
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );

  // Rutas públicas
  const publicRoutes = ['/login', '/'];
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname === route
  );

  // Si no hay token y está intentando acceder a rutas protegidas
  if (!token && isProtectedRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Si ya está logueado y va a rutas públicas, redirigir al dashboard
  if (token && isPublicRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

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