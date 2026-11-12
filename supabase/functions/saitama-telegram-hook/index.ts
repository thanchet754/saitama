// Saitama: Telegram bot webhook. "/start <code>" links the chat to the app account
// that created <code> (codes live 1 hour). Protected by Telegram's secret_token header.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TG = Deno.env.get('SAITAMA_TG_TOKEN')!;
const HOOK_SECRET = Deno.env.get('SAITAMA_TG_HOOK_SECRET')!;

const say = (chat_id: number, text: string) => fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text })
});

Deno.serve(async (req) => {
    if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== HOOK_SECRET) return new Response('forbidden', { status: 403 });
    try {
        const update = await req.json();
        const msg = update.message;
        if (!msg || !msg.text || !msg.chat) return new Response('ok');
        const chatId = msg.chat.id;
        const m = msg.text.trim().match(/^\/start(?:@\w+)?\s*(\S+)?/);
        if (!m) {
            await say(chatId, 'Bot này nhận video buổi tập từ app Saitama. Mở app → Video Buổi Tập → "Kết nối Telegram".');
            return new Response('ok');
        }
        const code = m[1];
        if (!code) {
            await say(chatId, 'Chào bạn! Để nhận video buổi tập, mở app Saitama → Video Buổi Tập → bấm "Kết nối Telegram".');
            return new Response('ok');
        }
        const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
        const since = new Date(Date.now() - 3600_000).toISOString();
        const { data: row } = await admin.from('saitama_telegram_codes').select('user_id').eq('code', code).gte('created_at', since).maybeSingle();
        if (!row) {
            await say(chatId, 'Mã kết nối đã hết hạn hoặc không đúng. Hãy bấm lại "Kết nối Telegram" trong app.');
            return new Response('ok');
        }
        const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || '';
        await admin.from('saitama_telegram_links').upsert({ user_id: row.user_id, chat_id: chatId, tg_name: name, linked_at: new Date().toISOString() });
        await admin.from('saitama_telegram_codes').delete().eq('user_id', row.user_id);
        await say(chatId, '✅ Đã kết nối! Từ giờ mỗi buổi tập trong app Saitama sẽ tự gửi video về đây.');
        return new Response('ok');
    } catch (_e) {
        return new Response('ok'); // never make Telegram retry forever
    }
});
