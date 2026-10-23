/* Unand journal metrics widget for any OJS theme. No dependencies; inherits the host page's fonts and colours.
   Usage: <div data-unand-journal="S4306516684"></div> or the text placeholder [unand-metrics S4306516684],
   plus <script src="https://…/assets/widget.js" defer></script>. Data: one precomputed file per journal. */
(() => {
    const script = document.currentScript, base = new URL('../', script ? script.src : location.href);
    const NS = 'http://www.w3.org/2000/svg', nf = new Intl.NumberFormat('id-ID'), df = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const num = v => v === null || v === undefined ? '—' : nf.format(v), dec = v => v === null || v === undefined ? 'Tidak tersedia' : df.format(v);
    const pct = v => v === null || v === undefined ? '—' : df.format(v) + '%';
    const TITLES = { four_year: 'Rasio sitasi 4 tahun', two_year: 'Rasio sitasi 2 tahun', fwci: 'FWCI jurnal' };
    const CSS = `.uam{font:inherit;color:inherit;line-height:1.5;max-width:100%}.uam *{box-sizing:border-box}
.uam h3,.uam h4{font-family:inherit;color:inherit;margin:0 0 .3em;line-height:1.25}.uam h3{font-size:1.25em;margin-top:1.2em}.uam h4{font-size:1em}
.uam p{margin:.3em 0}.uam small,.uam .uam-note{font-size:.82em;opacity:.78}
.uam-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(max(min(100%,290px),calc(50% - 7px)),1fr));gap:14px;margin:12px 0}
.uam-kpis{grid-template-columns:repeat(auto-fit,minmax(max(140px,calc(33.3% - 10px)),1fr))}
.uam-card{border:1px solid rgba(128,128,128,.3);border-radius:8px;padding:12px 14px;min-width:0;overflow-wrap:anywhere}
.uam-value{font-size:1.9em;font-weight:700;line-height:1.1;color:var(--uam-accent)}.uam-kpis .uam-value{font-size:1.45em}
.uam-warn{font-size:.82em;color:#9a5b00}.uam dl{display:grid;grid-template-columns:1fr auto;gap:4px 12px;margin:.6em 0}.uam dd{margin:0;font-weight:700;text-align:right}
.uam svg{display:block;width:100%;height:auto;overflow:visible}.uam svg text{fill:currentColor;font-size:10px}
.uam select{font:inherit;padding:4px 8px;max-width:100%}.uam-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:.8em;margin-top:6px}
.uam-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.uam table{width:100%;border-collapse:collapse;font-size:.92em}.uam th,.uam td{padding:6px 8px;border-bottom:1px solid rgba(128,128,128,.25);text-align:left;vertical-align:top}
.uam td.n,.uam th.n{text-align:right;white-space:nowrap}.uam-scroll{overflow-x:auto}.uam details{margin-top:6px;font-size:.85em}.uam summary{cursor:pointer}`;
    const el = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) v !== undefined && v !== null && n.setAttribute(k, v); n.append(...kids.filter(k => k !== null && k !== undefined)); return n; };
    const svg = (tag, attrs = {}, title) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (title) n.append(Object.assign(document.createElementNS(NS, 'title'), { textContent: title })); return n; };
    const safeURL = url => { try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; } };
    const range = (a, b) => a === b ? String(a) : `${a}–${b}`;

    // Charts are plain SVG with native tooltips; tables of numbers sit in a collapsed <details>.
    const W = 320, H = 150, L = 30, B = 22, T = 8, R = 6;
    function frame(label, maxY) {
        const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label });
        for (const f of [0, .5, 1]) {
            const y = T + (H - T - B) * (1 - f);
            s.append(svg('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: 'currentColor', 'stroke-opacity': f ? .12 : .35 }));
            s.append(Object.assign(svg('text', { x: L - 4, y: y + 3, 'text-anchor': 'end' }), { textContent: maxY * f >= 10 ? nf.format(Math.round(maxY * f)) : df.format(maxY * f) }));
        }
        return s;
    }
    // At most ~8 labels; the last label replaces a neighbour that would sit too close to it.
    const xLabels = (s, labels, x) => {
        const step = Math.ceil(labels.length / 8), last = labels.length - 1, shown = labels.map((_, i) => i).filter(i => i % step === 0);
        if (shown.at(-1) !== last) { if (last - shown.at(-1) < step) shown.pop(); shown.push(last); }
        for (const i of shown) s.append(Object.assign(svg('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }), { textContent: labels[i] }));
    };
    function lineChart(rows, { label, unit = '', reference = null, highlight }) {
        const values = rows.map(r => r.y).filter(v => v !== null), maxY = Math.max(...values, reference ?? 0, 1e-9) * 1.1;
        const s = frame(label, maxY), x = i => L + (W - L - R) * (rows.length === 1 ? .5 : i / (rows.length - 1)), y = v => T + (H - T - B) * (1 - v / maxY);
        if (reference !== null) s.append(svg('line', { x1: L, x2: W - R, y1: y(reference), y2: y(reference), stroke: 'currentColor', 'stroke-dasharray': '4 3', 'stroke-opacity': .55 }, `Acuan ${reference}`));
        let d = '', open = false;
        rows.forEach((r, i) => { if (r.y === null) { open = false; return; } d += `${open ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.y).toFixed(1)}`; open = true; });
        s.append(svg('path', { d, fill: 'none', stroke: 'var(--uam-accent)', 'stroke-width': 2 }));
        rows.forEach((r, i) => r.y !== null && s.append(svg('circle', { cx: x(i), cy: y(r.y), r: r.x === highlight ? 4.5 : 2.8, fill: r.x === highlight ? 'var(--uam-accent)' : 'currentColor', 'fill-opacity': r.x === highlight ? 1 : .55 }, `${r.x}: ${r.tip ?? dec(r.y)}${unit}`)));
        xLabels(s, rows.map(r => r.x), x);
        return s;
    }
    function barChart(rows, { label, unit = '', highlight }) {
        const maxY = Math.max(...rows.map(r => r.y), 1) * 1.1, s = frame(label, maxY), slot = (W - L - R) / rows.length, y = v => T + (H - T - B) * (1 - v / maxY);
        rows.forEach((r, i) => s.append(svg('rect', { x: L + slot * i + slot * .15, y: y(r.y), width: slot * .7, height: H - B - y(r.y), rx: 1.5, fill: 'var(--uam-accent)', 'fill-opacity': highlight && !highlight(r) ? .45 : .95 }, `${r.x}: ${num(r.y)}${unit}`)));
        xLabels(s, rows.map(r => r.x), i => L + slot * (i + .5));
        return s;
    }
    const shades = n => Array.from({ length: n }, (_, i) => i < 3 ? { c: 'var(--uam-accent)', o: [1, .62, .34][i] } : { c: 'currentColor', o: [.5, .3, .18][(i - 3) % 3] });
    function stackedChart(rows, names, { label, percent }) {
        const colors = shades(names.length), maxY = percent ? 100 : Math.max(...rows.map(r => r[1]), 1) * 1.1;
        const s = frame(label, maxY), slot = (W - L - R) / rows.length, scale = v => (H - T - B) * v / maxY;
        rows.forEach((r, i) => {
            let top = H - B;
            names.forEach((name, j) => {
                const v = percent ? (r[1] ? r[j + 2] / r[1] * 100 : 0) : r[j + 2], h = scale(v);
                if (h > 0) s.append(svg('rect', { x: L + slot * i + slot * .12, y: top - h, width: slot * .76, height: h, fill: colors[j].c, 'fill-opacity': colors[j].o }, `${r[0]} · ${name}: ${num(r[j + 2])} dari ${num(r[1])} karya`));
                top -= h;
            });
        });
        xLabels(s, rows.map(r => r[0]), i => L + slot * (i + .5));
        const legend = el('div', { class: 'uam-legend' });
        names.forEach((name, j) => { const box = el('i'); box.style.background = colors[j].c.startsWith('var') ? 'var(--uam-accent)' : 'currentColor'; box.style.opacity = colors[j].o; legend.append(el('span', {}, box, name)); });
        return [s, legend];
    }
    function hbar(rows, { label }) {
        const max = Math.max(...rows.map(r => r[1]), 1), rowH = 20, s = svg('svg', { viewBox: `0 0 ${W} ${rows.length * rowH + 4}`, role: 'img', 'aria-label': label });
        rows.forEach(([name, value], i) => {
            const y = i * rowH + 2, w = (W - 130) * value / max;
            s.append(Object.assign(svg('text', { x: 0, y: y + 13 }), { textContent: name.length > 20 ? name.slice(0, 19) + '…' : name }));
            s.append(svg('rect', { x: 110, y: y + 3, width: Math.max(w, 1), height: 13, rx: 1.5, fill: 'var(--uam-accent)' }, `${name}: ${num(value)} karya`));
            s.append(Object.assign(svg('text', { x: 114 + w, y: y + 13 }), { textContent: num(value) }));
        });
        return s;
    }
    const numbers = (head, rows) => { const d = el('details', {}, el('summary', {}, 'Lihat angka')), t = el('table'), tr = el('tr'); head.forEach((h, i) => tr.append(el('th', { class: i ? 'n' : '' }, h))); t.append(el('thead', {}, tr)); const b = el('tbody'); rows.forEach(r => { const row = el('tr'); r.forEach((v, i) => row.append(el('td', { class: i ? 'n' : '' }, String(v)))); b.append(row); }); t.append(b); d.append(el('div', { class: 'uam-scroll' }, t)); return d; };
    const card = (title, note, ...body) => el('div', { class: 'uam-card' }, el('h4', {}, title), note ? el('p', { class: 'uam-note' }, note) : null, ...body);

    function metricSection(data, host, year) {
        const pick = kind => data.series[kind].find(r => r.year === year), box = el('div');
        const select = el('select', { 'aria-label': 'Tahun metrik' });
        for (const y of [...data.years].reverse()) select.append(el('option', { value: y }, `${y}${y === data.snapshot_year ? ' (berjalan)' : ''}`));
        select.value = year;
        select.onchange = () => {
            const next = metricSection(data, el('div'), Number(select.value));
            host.replaceWith(next);
            next.querySelector('select').focus();
        };
        box.append(el('p', {}, el('label', {}, 'Tahun metrik ', select)));
        const grid = el('div', { class: 'uam-grid' });
        for (const kind of ['four_year', 'two_year']) {
            const r = pick(kind), dl = el('dl', {}, el('dt', {}, kind === 'four_year' ? 'Sitasi dalam jendela 4 tahun' : 'Sitasi pada tahun metrik'), el('dd', {}, num(r.numerator)),
                el('dt', {}, kind === 'four_year' ? 'Dokumen terbit dalam jendela' : 'Artikel dan review 2 tahun sebelumnya'), el('dd', {}, num(r.denominator)));
            grid.append(card(TITLES[kind], kind === 'four_year' ? 'Pola CiteScore · sitasi dan publikasi dalam jendela empat tahun yang sama' : 'Pola JIF · sitasi satu tahun kepada publikasi dua tahun sebelumnya',
                el('div', { class: 'uam-value' }, dec(r.value)), dl, el('p', { class: 'uam-note' }, `Publikasi ${range(r.publication_from, r.publication_to)} · sitasi ${range(r.citation_from, r.citation_to)}${r.status === 'provisional' ? ' · sementara, tahun belum lengkap' : ''}`),
                r.small_base ? el('p', { class: 'uam-warn' }, 'Basis dokumen kecil (kurang dari 30).') : null));
        }
        for (const kind of ['four_year', 'two_year']) {
            const rows = data.series[kind].map(r => ({ x: r.year, y: r.value }));
            grid.append(card(`Timeline ${TITLES[kind].toLowerCase()}`, null, lineChart(rows, { label: `Timeline ${TITLES[kind]}`, highlight: year }), numbers(['Tahun', 'Nilai'], rows.map(r => [r.x, dec(r.y)]))));
        }
        const f = pick('fwci');
        grid.append(card('FWCI jurnal', `Rerata FWCI karya terbitan ${year}; acuan global 1`, el('div', { class: 'uam-value' }, dec(f.value)),
            el('p', {}, `${num(f.denominator)} dari ${num(f.total_documents)} karya memiliki FWCI valid · cakupan ${pct(f.coverage)}`),
            f.window_incomplete ? el('p', { class: 'uam-warn' }, `Jendela sitasi ${year}–${year + 3} belum penuh.`) : null,
            f.small_base ? el('p', { class: 'uam-warn' }, 'Basis kecil (kurang dari 30 karya bermetrik).') : null,
            el('p', { class: 'uam-note' }, 'FWCI karya = sitasi diterima ÷ sitasi yang diharapkan untuk tahun, jenis, dan subbidang yang sama (OpenAlex).')));
        const fr = data.series.fwci.map(r => ({ x: r.year, y: r.value }));
        grid.append(card('Timeline FWCI jurnal', 'Garis putus-putus: acuan global FWCI 1', lineChart(fr, { label: 'Timeline FWCI jurnal', reference: 1, highlight: year }), numbers(['Tahun', 'FWCI'], fr.map(r => [r.x, dec(r.y)]))));
        const c = data.citations, w = c.three_year.find(r => r.year === year), span = range(w.from, w.to);
        grid.append(card('Sitasi per tahun', `Sitasi yang diterima seluruh karya jurnal per tahun sitasi; ${data.snapshot_year}* belum lengkap`,
            barChart(c.by_year.map(r => ({ x: `${r.year}${r.partial ? '*' : ''}`, y: r.citations, year: r.year })), { label: 'Sitasi per tahun', unit: ' sitasi', highlight: r => r.year >= w.from && r.year <= w.to }),
            el('dl', {}, el('dt', {}, `Total sitasi ${span}`), el('dd', { 'data-uam': 'all' }, num(w.citations)), el('dt', {}, `Total sitasi ${span} kepada karya terbitan ${span}`), el('dd', { 'data-uam': 'recent' }, num(w.recent_citations))),
            el('p', { class: 'uam-note' }, `Angka kedua hanya menghitung sitasi kepada ${num(w.recent_documents)} karya yang terbit pada ${span}.`)));
        const years = data.types.rows.map(r => ({ x: r[0], y: r[1] }));
        grid.append(card('Perjalanan publikasi jurnal', 'Jumlah karya menurut tahun publikasi', barChart(years, { label: 'Perjalanan publikasi jurnal', unit: ' karya' }), numbers(['Tahun', 'Karya'], years.map(r => [r.x, num(r.y)]))));
        box.append(grid);
        host.append(box);
        return host;
    }

    function render(mount, data) {
        const j = data.journal, k = data.kpis, root = el('div', { class: 'uam' }), dashboard = new URL(`#journals?journal=${j.id}`, base).href;
        const meta = [j.issn.length ? 'ISSN ' + j.issn.join(', ') : null, j.doaj === null ? null : `DOAJ: ${j.doaj ? 'ya' : 'tidak'}`, j.apc_usd === null ? null : `APC daftar US$ ${num(j.apc_usd)}`].filter(Boolean).join(' · ');
        root.append(el('p', { class: 'uam-note' }, `${meta ? meta + ' · ' : ''}Data OpenAlex, diperbarui ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(data.updated_at))}.`));
        const kpis = el('div', { class: 'uam-grid uam-kpis' });
        for (const [label, value, note] of [['Publikasi', num(k.publications), 'Karya unik'], ['Sitasi kumulatif', num(k.citations), 'Per tanggal snapshot'], ['Open access', pct(k.oa), 'Dapat dibaca terbuka'],
            ['Kolaborasi internasional', pct(k.international), 'Lebih dari satu negara'], ['Rerata FWCI', dec(k.fwci), `${num(k.fwci_n)} karya · ${pct(k.fwci_coverage)}`], ['Karya top 10 persen', num(k.top10), `Dari ${num(k.eligible)} karya bermetrik`]])
            kpis.append(el('div', { class: 'uam-card' }, el('small', {}, label), el('div', { class: 'uam-value' }, value), el('small', {}, note)));
        root.append(kpis, el('h3', {}, 'Dampak sitasi jurnal'));
        root.append(metricSection(data, el('div'), data.default_year));
        const grid = el('div', { class: 'uam-grid' });
        grid.append(card('Jenis karya menurut tahun', null, ...stackedChart(data.types.rows, data.types.names, { label: 'Jenis karya menurut tahun' })),
            card('Komposisi akses per tahun', 'Persentase karya per status OA', ...stackedChart(data.access.rows, data.access.names, { label: 'Komposisi akses per tahun', percent: true })),
            card('Negara afiliasi kontributor', 'Satu karya dapat masuk beberapa negara', hbar(data.countries, { label: 'Negara afiliasi kontributor' })));
        const o = data.origin, total = o.unand + o.external, share = total ? o.unand / total * 100 : 0, bar = svg('svg', { viewBox: `0 0 ${W} 26`, role: 'img', 'aria-label': 'Asal afiliasi penulis' });
        bar.append(svg('rect', { x: 0, y: 4, width: W * share / 100, height: 18, fill: 'var(--uam-accent)' }, `Ada afiliasi Unand: ${num(o.unand)} karya`), svg('rect', { x: W * share / 100, y: 4, width: W * (1 - share / 100), height: 18, fill: 'currentColor', 'fill-opacity': .25 }, `Tanpa afiliasi Unand: ${num(o.external)} karya`));
        grid.append(card('Asal afiliasi penulis', 'Karya dengan sedikitnya satu penulis Unand dibanding tanpa afiliasi Unand', bar,
            el('dl', {}, el('dt', {}, 'Ada afiliasi Unand'), el('dd', {}, `${num(o.unand)} (${pct(share)})`), el('dt', {}, 'Tanpa afiliasi Unand'), el('dd', {}, `${num(o.external)} (${pct(total ? 100 - share : null)})`))));
        root.append(grid, el('h3', {}, 'Artikel paling banyak disitasi'));
        const table = el('table'), head = el('tr'), body = el('tbody');
        for (const [h, n] of [['Judul', 0], ['Tahun', 1], ['Sitasi', 1], ['Akses', 0]]) head.append(el('th', { class: n ? 'n' : '' }, h));
        for (const a of data.articles) {
            const url = safeURL(a.doi), title = url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, a.title) : a.title;
            body.append(el('tr', {}, el('td', {}, title), el('td', { class: 'n' }, a.year ?? '—'), el('td', { class: 'n' }, num(a.citations)), el('td', {}, a.oa || '—')));
        }
        table.append(el('thead', {}, head), body);
        root.append(el('div', { class: 'uam-scroll' }, table), el('p', { class: 'uam-note' }, `${num(data.articles.length)} karya teratas menurut sitasi. Indikator dihitung dari metadata OpenAlex (CC0); bukan nilai resmi penyedia indeks lain. `,
            el('a', { href: dashboard, target: '_blank', rel: 'noopener noreferrer' }, 'Telusuri seluruh data di dashboard ↗')));
        mount.replaceChildren(root);
    }

    // Accent: explicit data-accent, else a theme link colour that stays readable on the widget's background.
    const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
    const luminance = ([r, g, b]) => [r, g, b].map(v => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
    const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };
    function background(node) {
        for (let n = node; n && n.nodeType === 1; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > .5) return c; }
        return [255, 255, 255];
    }
    function accent(mount) {
        const explicit = mount.getAttribute('data-accent');
        if (explicit && /^#?[0-9a-f]{3,8}$/i.test(explicit)) return explicit.startsWith('#') ? explicit : '#' + explicit;
        // Content links first (e.g. breadcrumbs), then the sidebar, then any link outside header/navigation bars.
        const bg = background(mount), content = mount.closest('.pkp_structure_main, main, article, .page');
        const candidates = [...(content ? content.querySelectorAll('a[href]') : []), ...document.querySelectorAll('.pkp_structure_sidebar a[href], aside a[href], #sidebar a[href]'),
            ...[...document.querySelectorAll('a[href]')].filter(a => !a.closest('header, nav, .pkp_structure_head, .pkp_navigation_primary_wrapper'))];
        for (const link of candidates) {
            if (link.closest('.uam')) continue;
            const color = getComputedStyle(link).color, c = rgb(color);
            if (c.length >= 3 && (c[3] ?? 1) > .5 && contrast(c, bg) >= 3) return color;
        }
        return contrast([31, 111, 92], bg) >= 3 ? '#1f6f5c' : 'currentColor';
    }
    async function mountWidget(mount) {
        // IDs are accepted in any case and with surrounding spaces, e.g. "s4210184296".
        const id = (mount.getAttribute('data-unand-journal') || '').trim().toUpperCase();
        if (!/^S\d{1,15}$/.test(id) || mount.dataset.uamReady) return;
        mount.dataset.uamReady = '1';
        mount.style.setProperty('--uam-accent', accent(mount));
        mount.textContent = 'Memuat metrik jurnal…';
        try {
            const response = await fetch(new URL(`data/journals/${id}.json`, base), { mode: 'cors' });
            if (!response.ok) throw new Error();
            const data = await response.json();
            if (data.schema_version !== 1 || data.journal?.id !== id) throw new Error();
            render(mount, data);
        } catch { mount.textContent = 'Metrik jurnal belum dapat dimuat.'; }
    }
    function start() {
        if (!document.getElementById('uam-style')) document.head.append(Object.assign(document.createElement('style'), { id: 'uam-style', textContent: CSS }));
        // Text placeholders survive editors that strip scripts and data attributes.
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), hits = [];
        while (walker.nextNode()) if (/\[unand-metrics\s+S\d{1,15}\]/i.test(walker.currentNode.nodeValue)) hits.push(walker.currentNode);
        for (const node of hits) {
            const id = node.nodeValue.match(/\[unand-metrics\s+(S\d{1,15})\]/i)[1].toUpperCase(), mount = el('div', { 'data-unand-journal': id });
            const block = node.parentElement && node.parentElement.textContent.trim() === node.nodeValue.trim() && node.parentElement !== document.body ? node.parentElement : null;
            if (block) block.replaceWith(mount); else node.replaceWith(mount);
        }
        document.querySelectorAll('[data-unand-journal]').forEach(mountWidget);
    }
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
