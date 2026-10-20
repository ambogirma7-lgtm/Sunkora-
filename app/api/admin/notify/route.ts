import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
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

function getNotificationImage(): Buffer | null {
  try {
    const p1 = path.join(process.cwd(), 'public', 'official_selected_report.png');
    if (fs.existsSync(p1)) return fs.readFileSync(p1);
    const p2 = path.join(process.cwd(), 'public', 'registration_closed_notification.png');
    if (fs.existsSync(p2)) return fs.readFileSync(p2);
    const p3 = path.join(
      process.cwd(),
      '.aistudio',
      'artifacts',
      'brain',
      '8bed1efe-ffed-4239-aaed-a1b34d574dd0',
      '.tempmediaStorage',
      'media_1792495461562_997a82f8.png'
    );
    if (fs.existsSync(p3)) return fs.readFileSync(p3);
  } catch (err) {
    console.warn('Could not read image file for notification:', err);
  }
  return null;
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
    const { message, target = 'APPROVED', adminName = 'Natananor', withImage = false } = body;

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

    const imageBuffer = withImage ? getNotificationImage() : null;

    for (const userId of recipientIds) {
      try {
        if (imageBuffer) {
          try {
            await bot.telegram.sendPhoto(
              Number(userId),
              { source: imageBuffer },
              {
                caption: formattedMessage,
                parse_mode: 'HTML',
              }
            );
            sentCount++;
            continue;
          } catch (imgErr) {
            console.warn(`Failed to send photo to ${userId}, falling back to text:`, imgErr);
          }
        }

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
      message: trimmedMsg + (withImage ? ' [📸 ከይፋዊ ሪፖርት ምስል ጋር የተላከ]' : ''),
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
      withImage: Boolean(imageBuffer),
      log,
    });
  } catch (error: any) {
    console.error('Error broadcasting notification:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
