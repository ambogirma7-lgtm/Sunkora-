import { NextResponse } from 'next/server';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RegistrationRecord } from '@/lib/registrationService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ambisaRecord: RegistrationRecord = {
      id: 'reg_2057666071',
      fullName: 'Ambisa Girma Ejita',
      phoneNumber: '+251919110619',
      livingPlace: 'S.W. Shawa/Soddo',
      occupation: 'Bank',
      interestConfirmation: 'Yes',
      telegramUserId: '2057666071',
      telegramUsername: '@PlanBCharts',
      isProxyRegistration: false,
      registeredByTelegramId: '',
      registeredByTelegramUsername: '',
      registeredByName: '',
      registrationDate: '2026-10-19T06:42:00.000Z',
      verificationStatus: 'Approved',
      approvedBy: 'Natananor',
      reviewedAt: '2026-10-19T06:45:00.000Z',
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'registrations', 'reg_2057666071'), ambisaRecord);

    return NextResponse.json({
      success: true,
      message: 'Ambisa Girma Ejita successfully re-added to registrations',
      record: ambisaRecord,
    });
  } catch (err: any) {
    console.error('Error re-adding Ambisa:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
