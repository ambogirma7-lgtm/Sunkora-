import { NextRequest, NextResponse } from 'next/server';
import { getAllRegistrations, searchRegistrations } from '@/lib/registrationService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');

    const records = q ? await searchRegistrations(q) : await getAllRegistrations();

    const stats = {
      total: records.length,
      pending: records.filter(
        (r) => r.verificationStatus === 'Pending Approval' || r.verificationStatus === 'Pending'
      ).length,
      approved: records.filter((r) => r.verificationStatus === 'Approved').length,
      rejected: records.filter((r) => r.verificationStatus === 'Rejected').length,
      direct: records.filter((r) => !r.isProxyRegistration).length,
      proxy: records.filter((r) => r.isProxyRegistration).length,
    };

    return NextResponse.json({
      success: true,
      records,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
