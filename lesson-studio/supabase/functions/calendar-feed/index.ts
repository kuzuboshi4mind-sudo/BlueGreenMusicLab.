// カレンダーの購読用 URL を配る Edge Function(汎用版で追加)
// GET /functions/v1/calendar-feed?token=…  → その講師の .ics(text/calendar)
// ・カレンダーアプリはログインできないので、推測できない token で講師を見分ける
// ・token に合う行だけを読む(サービス用の鍵は Supabase の中だけで使い、アプリには出さない)
// 公開のしかた(README の「カレンダーの同期の準備」):
//   supabase functions deploy calendar-feed --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve(async req => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
  const token = new URL(req.url).searchParams.get('token') || '';
  if (!/^[0-9a-f]{32,128}$/.test(token)) return new Response('Not Found', { status: 404 });
  const { data, error } = await db.from('calendar_feeds').select('ics').eq('token', token).maybeSingle();
  if (error) return new Response('Error', { status: 500 });
  if (!data) return new Response('Not Found', { status: 404 });
  return new Response(req.method === 'HEAD' ? null : data.ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="lessons.ics"',
      'cache-control': 'private, max-age=300',
    },
  });
});
