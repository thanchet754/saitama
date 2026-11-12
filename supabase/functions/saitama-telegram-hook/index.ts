// Saitama: Telegram bot webhook (protected by Telegram's secret_token header).
//  private chat:  /start <code>  -> links this chat to the app account that created <code> (codes live 1 hour)
//  group chat:    /setgroup      -> every workout video goes to this group (sender must be linked to the app;
//                                   once set, only the same person can change it)
//                 /unsetgroup    -> back to each user's own chat
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TG = Deno.env.get('SAITAMA_TG_TOKEN')!;
const HOOK_SECRET = Deno.env.get('SAITAMA_TG_HOOK_SECRET')!;

const say = (chat_id: number, text: string) => fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text })
});
const ok = () => new Response('ok');

Deno.serve(async (req) => {
    if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== HOOK_SECRET) return new Response('forbidden', { status: 403 });
    try {
        const update = await req.json();
        const msg = update.message;
        if (!msg || !msg.chat) return ok();
        const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
        const chatId = msg.chat.id;
        const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

        // a group upgraded to a supergroup gets a new id: follow it
        if (msg.migrate_to_chat_id) {
            await admin.from('saitama_telegram_config').update({ group_chat_id: msg.migrate_to_chat_id }).eq('group_chat_id', chatId);
            return ok();
        }
        if (!msg.text) return ok();
        const text = msg.text.trim();

        if (isGroup) {
            const cmd = text.match(/^\/(setgroup|unsetgroup)(?:@\w+)?\b/i);
            if (!cmd) return ok();
            const fromId = msg.from?.id;
            // the sender must have linked their own Telegram (private chat id = user id) to the app
            const { data: linked } = await admin.from('saitama_telegram_links').select('user_id').eq('chat_id', fromId).maybeSingle();
            if (!linked) {
                await say(chatId, 'Bạn cần kết nối Telegram với app trước: mở app Saitama → Video Buổi Tập → "Kết nối Telegram", rồi gõ lại lệnh ở đây.');
                return ok();
            }
            const { data: cfg } = await admin.from('saitama_telegram_config').select('*').eq('id', 1).maybeSingle();
            if (cfg && cfg.group_chat_id && cfg.owner_tg_id && cfg.owner_tg_id !== fromId) {
                await say(chatId, 'Chỉ người đã cài nhóm nhận video mới đổi được.');
                return ok();
            }
            if (cmd[1].toLowerCase() === 'setgroup') {
                await admin.from('saitama_telegram_config').upsert({
                    id: 1, group_chat_id: chatId, group_title: msg.chat.title || 'Nhóm', owner_tg_id: fromId, set_at: new Date().toISOString()
                });
                await say(chatId, '✅ Từ giờ mọi video buổi tập trong app Saitama sẽ gửi vào nhóm này.');
            } else {
                await admin.from('saitama_telegram_config').upsert({ id: 1, group_chat_id: null, group_title: null, owner_tg_id: fromId, set_at: new Date().toISOString() });
                await say(chatId, 'Đã tắt gửi vào nhóm. Video sẽ về chat riêng của từng người.');
            }
            return ok();
        }

        // private chat
        const m = text.match(/^\/start(?:@\w+)?\s*(\S+)?/);
        if (!m) {
            await say(chatId, 'Bot này nhận video buổi tập từ app Saitama. Mở app → Video Buổi Tập → "Kết nối Telegram".');
            return ok();
        }
        const code = m[1];
        if (!code) {
            await say(chatId, 'Chào bạn! Để nhận video buổi tập, mở app Saitama → Video Buổi Tập → bấm "Kết nối Telegram".');
            return ok();
        }
        const since = new Date(Date.now() - 3600_000).toISOString();
        const { data: row } = await admin.from('saitama_telegram_codes').select('user_id').eq('code', code).gte('created_at', since).maybeSingle();
        if (!row) {
            await say(chatId, 'Mã kết nối đã hết hạn hoặc không đúng. Hãy bấm lại "Kết nối Telegram" trong app.');
            return ok();
        }
        const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || '';
        await admin.from('saitama_telegram_links').upsert({ user_id: row.user_id, chat_id: chatId, tg_name: name, linked_at: new Date().toISOString() });
        await admin.from('saitama_telegram_codes').delete().eq('user_id', row.user_id);
        await say(chatId, '✅ Đã kết nối! Video buổi tập trong app Saitama sẽ tự gửi về Telegram.\n\nMuốn gửi vào nhóm chung: thêm bot vào nhóm rồi gõ /setgroup trong nhóm.');
        return ok();
    } catch (_e) {
        return ok(); // never make Telegram retry forever
    }
});
