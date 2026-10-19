import { NextRequest, NextResponse } from 'next/server';
import { updateRegistrationStatus, deleteRegistrationById } from '@/lib/registrationService';
import { bot } from '@/lib/botLogic';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { id, status, adminName } = await req.json();

    if (!id || !['Approved', 'Rejected'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
    }

    const updated = await updateRegistrationStatus(id, status, adminName || 'Admin');
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    // Try to notify member via Telegram
    try {
      const notifyId = updated.isProxyRegistration
        ? Number(updated.registeredByTelegramId)
        : Number(updated.telegramUserId);

      if (notifyId) {
        if (status === 'Approved') {
          const msg = updated.isProxyRegistration
            ? `🎉 <b>እንኳን ደስ አለዎት!</b>\n\nእርስዎ ያስመዘገቡት የ <b>${updated.fullName}</b> የምዝገባ ጥያቄ በአስተዳዳሪው ዘንድ <b>ተቀባይነት አግኝቶ ጸድቋል (Approved)</b>። እናመሰግናለን! 🙏`
            : `🎉 <b>እንኳን ደስ አለዎት ${updated.fullName}!</b>\n\nበሳንኮራ የመኖሪያ ቤት መሬት ፈላጊዎች ዝርዝር ውስጥ ያቀረቡት የምዝገባ ጥያቄ በአስተዳዳሪው ዘንድ <b>ተቀባይነት አግኝቶ ጸድቋል (Approved)</b>።\n\nወደፊት የሚኖሩ አዳዲስ መረጃዎችንና ቀጣይ ሂደቶችን በዚህ ቦት እናሳውቆታለን። እናመሰግናለን! 🙏`;
          await bot.telegram.sendMessage(notifyId, msg, { parse_mode: 'HTML' });
        } else {
          const msg = updated.isProxyRegistration
            ? `ሰላም፣ እርስዎ ያስመዘገቡት የ <b>${updated.fullName}</b> የምዝገባ ጥያቄ በአስተዳዳሪው ዘንድ ተቀባይነት አላገኘም።`
            : `ሰላም <b>${updated.fullName}</b>፣ ያቀረቡት የምዝገባ ጥያቄ በአስተዳዳሪው ዘንድ ተቀባይነት አላገኘም።`;
          await bot.telegram.sendMessage(notifyId, msg, { parse_mode: 'HTML' });
        }
      }
    } catch (err: any) {
      console.warn('Could not notify member:', err.message);
    }

    return NextResponse.json({ success: true, record: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing registration ID' }, { status: 400 });
    }

    const deleted = await deleteRegistrationById(id);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
