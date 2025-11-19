import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const auth = request.cookies.get('auth')?.value;

  // Rutas protegidas
  const protectedRoutes = ['/dashboard', '/projects'];
  const isProtected = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Rutas públicas
  const publicRoutes = ['/', '/login'];
  const isPublic = publicRoutes.some(route =>
    request.nextUrl.pathname === route
  );

  // No autenticado en ruta protegida → redirect a login
  if (!auth && isProtected) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Autenticado en ruta pública → redirect a dashboard
  if (auth && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
