import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/botLogic';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Received Telegram update:', JSON.stringify(body));
    await bot.handleUpdate(body);
    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error: any) {
    console.error('Telegram webhook processing error:', error);
    // Always return 200 to Telegram to prevent it from retrying repeatedly on unhandled exceptions
    return NextResponse.json({ success: false, error: error?.message || 'Internal error' });
  }
}

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  let botInfo: any = null;
  let webhookInfo: any = null;

  if (token) {
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      botInfo = await meRes.json();

      const whRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      webhookInfo = await whRes.json();
    } catch (e: any) {
      console.warn('Telegram info fetch error:', e);
    }
  }

  return NextResponse.json({
    status: 'online',
    botName: 'Sankora Land Registration Bot',
    hasToken: Boolean(token),
    botInfo: botInfo?.result || null,
    webhookInfo: webhookInfo?.result || null,
  });
}
