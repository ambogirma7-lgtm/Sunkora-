import { NextResponse } from 'next/server';
import { getAllRegistrations, generateCSV } from '@/lib/registrationService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const records = await getAllRegistrations();
    const csv = generateCSV(records);
    const dateStr = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Sankora_Land_Interested_Members_${dateStr}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
