import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = cookies();
  cookieStore.delete('auth_token');
  cookieStore.set('auth_token', '', { path: '/', maxAge: 0, expires: new Date(0) });
  return NextResponse.json({ success: true, message: 'Logged out' });
}
