import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from './admin';

export interface DecodedUser {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  admin?: boolean;
}

const MOCK_AUTH_ENABLED =
  process.env.ENABLE_MOCK_AUTH === '1' && process.env.NODE_ENV !== 'production';

export async function verifyAuth(req: NextRequest): Promise<DecodedUser | null> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1];

  if (MOCK_AUTH_ENABLED) {
    if (token === 'mock-token') {
      return {
        uid: 'dev-user-id',
        email: 'dev@coaching.local',
        name: 'Mock User',
        admin: true,
      };
    }
    if (token === 'mock-token-non-admin') {
      return {
        uid: 'non-admin-user-id',
        email: 'non-admin@coaching.local',
        name: 'Non-Admin User',
        admin: false,
      };
    }
    if (token === 'mock-token-no-profile') {
      return {
        uid: 'no-profile-user-id',
        email: 'no-profile@coaching.local',
        name: 'No-Profile User',
        admin: false,
      };
    }
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture,
      admin: decodedToken.admin === true,
    };
  } catch (error) {
    console.error('Firebase token validation failed:', error);
    return null;
  }
}

export async function requireAdmin(req: NextRequest, user: DecodedUser): Promise<NextResponse | null> {
  if (user.admin === true) return null;
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
  if (user.email && adminEmails.includes(user.email)) return null;
  return NextResponse.json(
    { error: 'Accès refusé. Rôle administrateur requis.' },
    { status: 403 }
  );
}

/**
 * Higher-order helper to wrap Next.js Route Handlers with Auth verification
 */
export async function withAuth(
  req: NextRequest,
  handler: (req: NextRequest, user: DecodedUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await verifyAuth(req);
  
  if (!user) {
    return NextResponse.json(
      { error: 'Authentification requise. Jeton invalide ou expiré.' },
      { status: 401 }
    );
  }
  
  return handler(req, user);
}
