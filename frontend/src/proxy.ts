import { NextResponse, type NextRequest } from 'next/server';
import { canViewBusinessDashboard } from './lib/business-dashboard-auth';

export function proxy(request: NextRequest) {
  if (!canViewBusinessDashboard(request.headers.get('authorization'))) {
    return new NextResponse('Business credentials are required.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Bookify Business", charset="UTF-8"',
        'Cache-Control': 'private, no-store',
      },
    });
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: '/business/:path*' };
