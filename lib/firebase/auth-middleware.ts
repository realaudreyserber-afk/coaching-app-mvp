import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from './admin';

export interface DecodedUser {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Verifies the Authorization header containing the Firebase ID Token
 * @param req NextRequest
 * @returns DecodedUser or null if authentication fails
 */
export async function verifyAuth(req: NextRequest): Promise<DecodedUser | null> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    // If adminAuth is not initialized (e.g. env vars missing during initial build/local setup without credentials),
    // fallback or fail gracefully
    if (!adminAuth) {
      console.warn('Firebase Admin Auth not initialized. Authenticating as dummy for development.');
      if (process.env.NODE_ENV === 'development') {
        return { uid: 'dev-user-id', email: 'dev@coaching.local' };
      }
      return null;
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture,
    };
  } catch (error) {
    console.error('Firebase token validation failed:', error);
    return null;
  }
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
