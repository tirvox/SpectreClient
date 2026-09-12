// Vercel Serverless: /api/changelog
// Токен НЕ в коде — только в Vercel → Settings → Environment Variables → DISCORD_BOT_TOKEN
// Канал: 1535224011322298439

const CHANNEL_ID = '1535224011322298439';

function parseDiffLines(text) {
  if (!text) return { adds: [], removes: [] };
  // Достаем все ```diff ... ``` блоки, если есть. Если нет — парсим весь текст.
  const blocks = [];
  const re = /```diff([\s\S]*?)```/gi;
  let m;
  while ((m = re.exec(text)) !== null) blocks.push(m[1]);
  const source = blocks.length ? blocks.join('\n') : text;

  const adds = [];
  const removes = [];
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('+') && !line.startsWith('+++') && line.length > 1) {
      adds.push(line.slice(1).trim());
    } else if (line.startsWith('-') && !line.startsWith('---') && line.length > 1) {
      removes.push(line.slice(1).trim());
    }
  }
  return { adds, removes };
}

export default async function handler(req, res) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'No DISCORD_BOT_TOKEN env' });
  }
  try {
    const r = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=20`, {
      headers: { Authorization: `Bot ${token}` }
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: 'Discord API error', detail: t.slice(0, 300) });
    }
    const msgs = await r.json();
    const out = [];
    for (const msg of msgs) {
      const { adds, removes } = parseDiffLines(msg.content || '');
      if (!adds.length && !removes.length) continue; // показываем только +/- строки
      const jar = (msg.attachments || []).find(a => (a.filename || '').endsWith('.jar'));
      out.push({
        id: msg.id,
        date: msg.timestamp,
        adds,
        removes,
        jarUrl: jar ? jar.url : null,
        jarName: jar ? jar.filename : null
      });
    }
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: 'fetch failed', detail: String(e).slice(0, 300) });
  }
}
