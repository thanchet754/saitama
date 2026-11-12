// Saitama: forward one uploaded workout video (segment) to the user's Telegram chat,
// then delete the copy from Supabase Storage.
// Called by the app (with the user's JWT) right after a segment finished uploading.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TG = Deno.env.get('SAITAMA_TG_TOKEN')!;
const BUCKET = 'saitama-videos';
const TG_MAX = 50 * 1024 * 1024;

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const partPath = (uid: string, clientId: number | string, i: number) => `${uid}/${clientId}/part-${String(i).padStart(3, '0')}`;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    try {
        const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return json({ error: 'unauthorized' }, 401);

        const { client_id } = await req.json();
        const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
        const { data: row, error } = await admin.from('saitama_videos').select('*')
            .eq('user_id', user.id).eq('client_id', client_id).maybeSingle();
        if (error || !row) return json({ error: 'not_found' }, 404);
        if (row.telegram_status === 'sent') return json({ status: 'sent' });

        const setStatus = (patch: Record<string, unknown>) =>
            admin.from('saitama_videos').update(patch).eq('user_id', user.id).eq('client_id', client_id);

        const { data: link } = await admin.from('saitama_telegram_links').select('chat_id').eq('user_id', user.id).maybeSingle();
        if (!link) { await setStatus({ telegram_status: 'no_link' }); return json({ status: 'no_link' }); }
        if (row.size_bytes > TG_MAX) { await setStatus({ telegram_status: 'too_large' }); return json({ status: 'too_large' }); }

        // reassemble the file from its parts
        const parts: Blob[] = [];
        for (let i = 0; i < row.parts; i++) {
            const { data, error: e } = await admin.storage.from(BUCKET).download(partPath(user.id, client_id, i));
            if (e || !data) { await setStatus({ telegram_status: 'error', telegram_error: 'missing part ' + i }); return json({ status: 'error' }, 500); }
            parts.push(data);
        }
        const file = new File(parts, row.file_name, { type: row.mime });

        const form = new FormData();
        form.append('chat_id', String(link.chat_id));
        form.append('caption', (row.caption || row.file_name).slice(0, 1000));
        form.append('supports_streaming', 'true');
        const isMp4 = String(row.mime).includes('mp4');
        form.append(isMp4 ? 'video' : 'document', file);
        const res = await fetch(`https://api.telegram.org/bot${TG}/${isMp4 ? 'sendVideo' : 'sendDocument'}`, { method: 'POST', body: form });
        const tg = await res.json();
        if (!tg.ok) {
            await setStatus({ telegram_status: 'error', telegram_error: String(tg.description || res.status).slice(0, 300) });
            return json({ status: 'error', detail: tg.description }, 502);
        }

        // delivered: free the Supabase storage
        const paths = Array.from({ length: row.parts }, (_, i) => partPath(user.id, client_id, i));
        const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
        await setStatus({
            telegram_status: 'sent', telegram_message_id: tg.result.message_id, telegram_error: null,
            storage_deleted: !rmErr
        });
        return json({ status: 'sent', message_id: tg.result.message_id });
    } catch (e) {
        return json({ status: 'error', detail: String(e) }, 500);
    }
});
