import { NextRequest, NextResponse } from 'next/server';
import {
  getAllRegistrations,
  saveNotificationLog,
  getNotificationLogs,
} from '@/lib/registrationService';

export const dynamic = 'force-dynamic';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function GET() {
  try {
    const logs = await getNotificationLogs();
    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, target = 'APPROVED', adminName = 'Natananor' } = body;

    const trimmedMsg = (message || '').trim();
    if (!trimmedMsg) {
      return NextResponse.json(
        { success: false, error: 'የሚላከው መልእክት ባዶ መሆን አይችልም (Message cannot be empty)' },
        { status: 400 }
      );
    }

    const allRecords = await getAllRegistrations();
    const targetRecords =
      target === 'ALL'
        ? allRecords
        : allRecords.filter((r) => r.verificationStatus === 'Approved');

    // Collect distinct Telegram User IDs to notify
    const recipientMap = new Map<string, string>(); // userId -> name
    for (const r of targetRecords) {
      if (r.isProxyRegistration && r.registeredByTelegramId) {
        recipientMap.set(
          String(r.registeredByTelegramId),
          r.registeredByName || r.fullName
        );
      } else if (r.telegramUserId) {
        recipientMap.set(String(r.telegramUserId), r.fullName);
      }
    }

    const recipientIds = Array.from(recipientMap.keys());
    const totalTargeted = recipientIds.length;

    if (totalTargeted === 0) {
      return NextResponse.json({
        success: false,
        error:
          target === 'APPROVED'
            ? 'ምንም የጸደቀ አባል አልተገኘም (No approved members found)'
            : 'ምንም የተመዘገበ አባል አልተገኘም (No registered members found)',
      });
    }

    const { bot } = await import('@/lib/botLogic');

    let sentCount = 0;
    let failedCount = 0;

    const formattedMessage =
      `📢 <b>አዲስ ማሳወቂያ ከሳንኮራ የመኖሪያ ቤት መሬት ምዝገባ አስተዳደር፦</b>\n\n` +
      `${escapeHtml(trimmedMsg)}\n\n` +
      `<i>📅 ${new Date().toLocaleDateString('am-ET')} • አስተዳዳሪ @${adminName}</i>`;

    for (const userId of recipientIds) {
      try {
        await bot.telegram.sendMessage(Number(userId), formattedMessage, {
          parse_mode: 'HTML',
        });
        sentCount++;
      } catch (err: any) {
        console.warn(`Failed to send notification to Telegram user ${userId}:`, err?.message);
        failedCount++;
      }
    }

    const log = await saveNotificationLog({
      message: trimmedMsg,
      target: target as 'APPROVED' | 'ALL',
      sentCount,
      failedCount,
      totalTargeted,
      sentBy: adminName,
    });

    return NextResponse.json({
      success: true,
      sentCount,
      failedCount,
      totalTargeted,
      log,
    });
  } catch (error: any) {
    console.error('Error broadcasting notification:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
