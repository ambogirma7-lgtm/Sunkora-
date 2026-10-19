const https = require('https');
const http = require('http');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.log('[Poller] No TELEGRAM_BOT_TOKEN found. Poller disabled.');
  process.exit(0);
}

console.log('[Poller] Starting Telegram Bot Long-Polling runner...');

function deleteWebhook() {
  return new Promise((resolve) => {
    https
      .get(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          console.log('[Poller] Webhook cleared for long-polling.');
          resolve();
        });
      })
      .on('error', (err) => {
        console.warn('[Poller] Error clearing webhook:', err.message);
        resolve();
      });
  });
}

function postToLocalWebhook(update) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(update);
    const req = http.request(
      'http://127.0.0.1:3000/api/webhook/telegram',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 15000,
      },
      (res) => {
        let resData = '';
        res.on('data', (c) => (resData += c));
        res.on('end', () => resolve(true));
      }
    );
    req.on('error', (err) => {
      console.warn('[Poller] Local webhook delivery error (dev server may be starting):', err.message);
      resolve(false);
    });
    req.write(postData);
    req.end();
  });
}

let offset = 0;
let isRunning = true;

async function pollLoop() {
  await deleteWebhook();

  while (isRunning) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?timeout=20&offset=${offset}`;
      const updates = await new Promise((resolve) => {
        const req = https.get(url, { timeout: 30000 }, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.result || []);
            } catch {
              resolve([]);
            }
          });
        });
        req.on('error', (err) => {
          console.warn('[Poller] Telegram network error:', err.message);
          resolve(null);
        });
      });

      if (updates && Array.isArray(updates) && updates.length > 0) {
        for (const update of updates) {
          offset = update.update_id + 1;
          await postToLocalWebhook(update);
        }
      } else if (updates === null) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error('[Poller] Loop error:', err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

pollLoop();
