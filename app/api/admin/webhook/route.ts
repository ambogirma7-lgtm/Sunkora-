import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured' });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await res.json();
    return NextResponse.json({ success: true, webhookInfo: data.result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured' });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl =
      body.url ||
      `${process.env.APP_URL || 'https://ais-dev-a3erwiudtgvrw75tr2b3s2-554459793227.europe-west2.run.app'}/api/webhook/telegram`;

    const setRes = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(targetUrl)}`
    );
    const data = await setRes.json();

    return NextResponse.json({
      success: data.ok,
      result: data,
      url: targetUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
