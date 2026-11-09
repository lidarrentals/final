(() => {
    const C = window.KB_CONFIG, $ = s => document.querySelector(s);
    const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let DOCS = [], cats = [], cur = null, q = '', busy = false, gen = 0, going = false;
    const blobs = new Map();

    const view = on => {
        $('#auth').hidden = on; $('#app').hidden = !on;
        ['#sw', '#whobox'].forEach(s => $(s).hidden = !on); $('#menu').hidden = !on;
    };
    const say = t => { $('#msg').textContent = t || ''; };

    async function load(path) {
        if (blobs.has(path)) return blobs.get(path);
        const { data, error } = await sb.storage.from(C.BUCKET).download('app/' + path.replace(/^img\//, ''));
        if (error) throw error;
        const u = URL.createObjectURL(data); blobs.set(path, u); return u;
    }

    async function enter(session) {
        if (busy || DOCS.length) return; busy = true;
        const { data, error } = await sb.storage.from(C.BUCKET).download('manifest.json');
        if (error || !data) {
            busy = false; await sb.auth.signOut();
            say('This account doesn’t have access to the knowledge base. Ask the administrator to add you.'); return;
        }
        DOCS = JSON.parse(await data.text()); cats = [...new Set(DOCS.map(d => d.cat))];
        $('#who').textContent = session.user.email; view(true); busy = false; route();
    }

    function leave() {
        DOCS = []; cur = null; q = ''; $('#q').value = '';
        blobs.forEach(u => URL.revokeObjectURL(u)); blobs.clear();
        $('#main').innerHTML = ''; $('#nav').innerHTML = ''; document.body.classList.remove('nav'); view(false);
    }

    function nav() {
        $('#nav').innerHTML = cats.map(c => {
            let sub = null, h = '';
            DOCS.filter(d => d.cat === c).forEach(d => {
                if (d.sub !== sub) { sub = d.sub; if (sub) h += `<div class="sub">${esc(sub)}</div>`; }
                h += `<a href="#${d.id}" class="${cur && cur.id === d.id ? 'on' : ''}">${esc(d.title)}</a>`;
            });
            return `<details ${(!cur || cur.cat === c) ? 'open' : ''}><summary>${esc(c)}</summary>${h}</details>`;
        }).join('');
    }

    function home() {
        const m = $('#main'); m.className = 'one';
        m.innerHTML = `<div><div class="hero"><h1>How can we help?</h1><p>Setup guides, flight procedures, post-processing and troubleshooting for your rental equipment.</p></div><div class="grid">` +
            cats.map(c => `<div class="card"><h3>${esc(c)}</h3>${DOCS.filter(d => d.cat === c).map(d => `<a href="#${d.id}">${esc(d.title)}</a>`).join('')}</div>`).join('') + `</div></div>`;
    }

    function results() {
        const m = $('#main'); m.className = 'one';
        const ts = q.toLowerCase().split(/\s+/).filter(Boolean);
        const rs = DOCS.map(d => {
            const t = d.title.toLowerCase(), x = d.text.toLowerCase();
            if (!ts.every(w => t.includes(w) || x.includes(w))) return null;
            let s = 0; ts.forEach(w => { if (t.includes(w)) s += 20; s += Math.min(x.split(w).length - 1, 15); });
            return { d, s };
        }).filter(Boolean).sort((a, b) => b.s - a.s);
        const hl = t => ts.reduce((a, w) => a.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'), esc(t));
        m.innerHTML = `<div><h1>${rs.length} result${rs.length === 1 ? '' : 's'}</h1>` + rs.map(({ d }) => {
            const i = Math.max(0, d.text.toLowerCase().indexOf(ts[0])), sn = d.text.slice(Math.max(0, i - 60), i + 160);
            return `<a class="res" href="#${d.id}" data-open><b>${hl(d.title)}</b><small>${esc(d.cat)}${d.sub ? ' › ' + esc(d.sub) : ''}</small><p>…${hl(sn)}…</p></a>`;
        }).join('') + `</div>`;
    }

    function article(d) {
        const m = $('#main'); m.className = 'one';
        const i = DOCS.indexOf(d), p = DOCS[i - 1], n = DOCS[i + 1];
        m.innerHTML = `<div><div class="crumb">${esc(d.cat)}${d.sub ? ' › ' + esc(d.sub) : ''}</div><h1 class="sr">${esc(d.title)}</h1>
    <div class="sheet">${d.slices.map(s => `<img alt="" width="${s.w}" height="${s.h}" data-p="${esc(s.f)}">`).join('')}</div>
    <div class="pn">${p ? `<a href="#${p.id}"><small>Previous</small>${esc(p.title)}</a>` : '<span style="flex:1"></span>'}${n ? `<a href="#${n.id}"><small>Next</small>${esc(n.title)}</a>` : '<span style="flex:1"></span>'}</div></div>`;
        const my = ++gen, imgs = [...m.querySelectorAll('img[data-p]')]; let k = 0;
        const worker = async () => {
            while (k < imgs.length) {
                const el = imgs[k++];
                try { const u = await load(el.dataset.p); if (my === gen) el.src = u; } catch (e) { el.alt = 'This image could not be loaded.'; }
            }
        };
        [1, 2, 3, 4].forEach(worker);
    }

    function route() {
        if (!DOCS.length) return;
        cur = DOCS.find(d => d.id === location.hash.slice(1)) || null; document.body.classList.remove('nav');
        document.title = (cur ? cur.title + ' · ' : '') + 'Knowledge Base · lidar.rentals';
        if (q.trim()) results(); else if (cur) article(cur); else home();
        nav(); window.scrollTo(0, 0);
    }

    $('#login').addEventListener('submit', async e => {
        e.preventDefault(); say('Signing in (v2)…'); going = true;
        const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#pw').value });
        if (error) { going = false; return say('Email or password is incorrect.'); }
        if (C.AFTER_LOGIN_URL) location.replace(C.AFTER_LOGIN_URL); else { going = false; enter((await sb.auth.getSession()).data.session); }
    });
    $('#link').addEventList