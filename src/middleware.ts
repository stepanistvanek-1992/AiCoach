import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Ignorovat statické soubory, PWA assets a API pro přihlášení
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api/auth') ||
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/manifest.webmanifest' ||
    request.nextUrl.pathname === '/sw.js' ||
    request.nextUrl.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get('ai_coach_auth');

  // Pokud není cookie nebo není platná, přesměrovat na /login
  if (!authCookie || authCookie.value !== 'authenticated') {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
