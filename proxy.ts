import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/callback',
  '/setup',
  '/manifest.json',
  '/sw.js',
  '/firebase-messaging-sw.js',
  '/robots.txt',
  '/api/health',
];

const PUBLIC_PREFIXES = [
  '/_next',
  '/api/auth',
  '/favicon',
  '/icons',
  '/images',
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  if (pathname.startsWith('/api')) {
    const auth = req.headers.get('authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentification requise.' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  const session = req.cookies.get('__session')?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals, well-known paths AND any file with a common
    // static-asset extension at any depth (so /garthe-rate.jpeg at the
    // root of /public is served, not redirected to /login).
    '/((?!_next/static|_next/image|favicon.ico|icons|images|manifest.json|sw.js|firebase-messaging-sw.js|.*\\.(?:jpg|jpeg|png|gif|webp|avif|svg|ico|woff|woff2|ttf)$).*)',
  ],
};
