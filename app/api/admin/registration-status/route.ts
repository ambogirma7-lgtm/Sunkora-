import { NextRequest, NextResponse } from 'next/server';
import { isRegistrationOpen, setRegistrationOpen } from '@/lib/registrationService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const isOpen = await isRegistrationOpen();
    return NextResponse.json({ success: true, isOpen });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const isOpen = Boolean(body.isOpen);
    const success = await setRegistrationOpen(isOpen);
    return NextResponse.json({ success, isOpen });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
