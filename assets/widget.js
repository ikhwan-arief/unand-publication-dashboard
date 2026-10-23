/* Unand journal metrics widget for any OJS theme. No dependencies; inherits the host page's fonts and colours.
   Usage: <div data-unand-journal="S4306516684"></div> or the text placeholder [unand-metrics S4306516684],
   plus <script src="https://…/assets/widget.js" defer></script>. Data: one precomputed file per journal.
   Language follows <html lang> of the OJS page (Indonesian or English); data-lang="en|id" or
   [unand-metrics S… en] fixes it. */
(() => {
    const script = document.currentScript, base = new URL('../', script ? script.src : location.href);
    const NS = 'http://www.w3.org/2000/svg';
    // Widget-only strings; the dashboard itself stays Indonesian.
    const TEXT = {
        id: { locale: 'id-ID', na: 'Tidak tersedia', loading: 'Memuat metrik jurnal…', failed: 'Metrik jurnal belum dapat dimuat.',
            four_year: 'Rasio sitasi 4 tahun', two_year: 'Rasio sitasi 2 tahun', fwci: 'FWCI jurnal', timeline: t => `Timeline ${t.toLowerCase()}`, timelineFwci: 'Timeline FWCI jurnal',
            metricYear: 'Tahun metrik', running: ' (berjalan)', reference: r => `Acuan ${r}`, numbers: 'Lihat angka', year: 'Tahun', value: 'Nilai', works: 'Karya',
            fourNum: 'Sitasi dalam jendela 4 tahun', twoNum: 'Sitasi pada tahun metrik', fourDen: 'Dokumen terbit dalam jendela', twoDen: 'Artikel dan review 2 tahun sebelumnya',
            fourNote: 'Pola CiteScore · sitasi dan publikasi dalam jendela empat tahun yang sama', twoNote: 'Pola JIF · sitasi satu tahun kepada publikasi dua tahun sebelumnya',
            windows: (p, c, prov) => `Publikasi ${p} · sitasi ${c}${prov ? ' · sementara, tahun belum lengkap' : ''}`, smallBase: 'Basis dokumen kecil (kurang dari 30).',
            fwciNote: y => `Rerata FWCI karya terbitan ${y}; acuan global 1`, fwciCover: (n, t, c) => `${n} dari ${t} karya memiliki FWCI valid · cakupan ${c}`,
            fwciWindow: (a, b) => `Jendela sitasi ${a}–${b} belum penuh.`, fwciSmall: 'Basis kecil (kurang dari 30 karya bermetrik).',
            fwciDef: 'FWCI karya = sitasi diterima ÷ sitasi yang diharapkan untuk tahun, jenis, dan subbidang yang sama (OpenAlex).', fwciDash: 'Garis putus-putus: acuan global FWCI 1',
            perYear: 'Sitasi per tahun', perYearNote: y => `Sitasi yang diterima seluruh karya jurnal per tahun sitasi; ${y}* belum lengkap`, citations: ' sitasi', worksUnit: ' karya',
            total: s => `Total sitasi ${s}`, totalRecent: s => `Total sitasi ${s} kepada karya terbitan ${s}`, recentNote: (n, s) => `Angka kedua hanya menghitung sitasi kepada ${n} karya yang terbit pada ${s}.`,
            output: 'Perjalanan publikasi jurnal', outputNote: 'Jumlah karya menurut tahun publikasi', of: (a, b) => `${a} dari ${b} karya`,
            yes: 'ya', no: 'tidak', apc: v => `APC daftar US$ ${v}`, updated: d => `Data OpenAlex, diperbarui ${d}.`,
            kpis: [['Publikasi', 'Karya unik'], ['Sitasi kumulatif', 'Per tanggal snapshot'], ['Open access', 'Dapat dibaca terbuka'], ['Kolaborasi internasional', 'Lebih dari satu negara'], ['Rerata FWCI', (n, c) => `${n} karya · ${c}`], ['Karya top 10 persen', n => `Dari ${n} karya bermetrik`]],
            impact: 'Dampak sitasi jurnal', types: 'Jenis karya menurut tahun', access: 'Komposisi akses per tahun', accessNote: 'Persentase karya per status OA',
            countries: 'Negara afiliasi kontributor', countriesNote: 'Satu karya dapat masuk beberapa negara', origin: 'Asal afiliasi penulis', originNote: 'Karya dengan sedikitnya satu penulis Unand dibanding tanpa afiliasi Unand',
            unand: 'Ada afiliasi Unand', external: 'Tanpa afiliasi Unand', articles: 'Artikel paling banyak disitasi', columns: ['Judul', 'Tahun', 'Sitasi', 'Akses'],
            footer: n => `${n} karya teratas menurut sitasi. Indikator dihitung dari metadata OpenAlex (CC0); bukan nilai resmi penyedia indeks lain.` },
        en: { locale: 'en-US', na: 'Not available', loading: 'Loading journal metrics…', failed: 'Journal metrics could not be loaded.',
            four_year: '4-year citation ratio', two_year: '2-year citation ratio', fwci: 'Journal FWCI', timeline: t => `${t} timeline`, timelineFwci: 'Journal FWCI timeline',
            metricYear: 'Metric year', running: ' (current)', reference: r => `Benchmark ${r}`, numbers: 'Show values', year: 'Year', value: 'Value', works: 'Works',
            fourNum: 'Citations in the 4-year window', twoNum: 'Citations in the metric year', fourDen: 'Documents published in the window', twoDen: 'Articles and reviews of the 2 previous years',
            fourNote: 'CiteScore-style · citations and publications in the same four-year window', twoNote: 'JIF-style · one year of citations to the two previous publication years',
            windows: (p, c, prov) => `Publications ${p} · citations ${c}${prov ? ' · provisional, year not complete' : ''}`, smallBase: 'Small base (fewer than 30 documents).',
            fwciNote: y => `Mean FWCI of works published in ${y}; global benchmark 1`, fwciCover: (n, t, c) => `${n} of ${t} works have a valid FWCI · coverage ${c}`,
            fwciWindow: (a, b) => `Citation window ${a}–${b} is not complete yet.`, fwciSmall: 'Small base (fewer than 30 works with a score).',
            fwciDef: 'Work FWCI = citations received ÷ citations expected for the same year, type and subfield (OpenAlex).', fwciDash: 'Dashed line: global FWCI benchmark 1',
            perYear: 'Citations per year', perYearNote: y => `Citations received by all journal works per citation year; ${y}* is not complete`, citations: ' citations', worksUnit: ' works',
            total: s => `Total citations ${s}`, totalRecent: s => `Total citations ${s} to works published ${s}`, recentNote: (n, s) => `The second figure only counts citations to the ${n} works published in ${s}.`,
            output: 'Journal output by year', outputNote: 'Number of works by publication year', of: (a, b) => `${a} of ${b} works`,
            yes: 'yes', no: 'no', apc: v => `List APC US$ ${v}`, updated: d => `OpenAlex data, updated ${d}.`,
            kpis: [['Publications', 'Unique works'], ['Cumulative citations', 'As of the snapshot date'], ['Open access', 'Free to read'], ['International collaboration', 'More than one country'], ['Mean FWCI', (n, c) => `${n} works · ${c}`], ['Top 10% works', n => `Of ${n} works with a score`]],
            impact: 'Journal citation impact', types: 'Work types by year', access: 'Access status by year', accessNote: 'Share of works per OA status',
            countries: 'Contributor countries', countriesNote: 'A work can count for several countries', origin: 'Author affiliation', originNote: 'Works with at least one Unand author versus works without a Unand affiliation',
            unand: 'With Unand affiliation', external: 'Without Unand affiliation', articles: 'Most cited articles', columns: ['Title', 'Year', 'Citations', 'Access'],
            footer: n => `Top ${n} works by citations. Indicators are computed from OpenAlex metadata (CC0); they are not official values of any index provider.` },
    };
    let S = TEXT.id, nf, df;
    const setLanguage = lang => { S = TEXT[lang] || TEXT.id; nf = new Intl.NumberFormat(S.locale); df = new Intl.NumberFormat(S.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    setLanguage('id');
    // data-lang wins; otherwise the OJS page language: Indonesian for id/ms, English for any other declared language.
    const languageOf = mount => { const own = (mount.getAttribute('data-lang') || '').toLowerCase(), page = (document.documentElement.lang || '').toLowerCase();
        return own === 'en' || own === 'id' ? own : !page || /^(id|ms|in)\b/.test(page) ? 'id' : 'en'; };
    const num = v => v === null || v === undefined ? '—' : nf.format(v), dec = v => v === null || v === undefined ? S.na : df.format(v);
    const pct = v => v === null || v === undefined ? '—' : df.format(v) + '%';
    const CSS = `.uam{font:inherit;color:inherit;line-height:1.5;max-width:100%}.uam *{box-sizing:border-box}
.uam h3,.uam h4{font-family:inherit;color:inherit;margin:0 0 .3em;line-height:1.25}.uam h3{font-size:1.25em;margin-top:1.2em}.uam h4{font-size:1em}
.uam p{margin:.3em 0}.uam small,.uam .uam-note{font-size:.82em;opacity:.78}
.uam-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(max(min(100%,290px),calc(50% - 7px)),1fr));gap:14px;margin:12px 0}
.uam-kpis{grid-template-columns:repeat(auto-fit,minmax(max(140px,calc(33.3% - 10px)),1fr))}
.uam-card{border:1px solid rgba(128,128,128,.3);border-radius:8px;padding:12px 14px;min-width:0;overflow-wrap:anywhere}
.uam-value{font-size:1.9em;font-weight:700;line-height:1.1;color:var(--uam-accent)}.uam-kpis .uam-value{font-size:1.45em}
.uam-warn{font-size:.82em;color:#9a5b00}.uam dl{display:grid;grid-template-columns:1fr auto;gap:4px 12px;margin:.6em 0}.uam dd{margin:0;font-weight:700;text-align:right}
.uam svg{display:block;width:100%;height:auto;overflow:visible}.uam svg text{fill:currentColor;font-size:.72em}
.uam select{font:inherit;padding:4px 8px;max-width:100%}.uam-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:.8em;margin-top:6px}
.uam-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.uam table{width:100%;border-collapse:collapse;font-size:.92em}.uam th,.uam td{padding:6px 8px;border-bottom:1px solid rgba(128,128,128,.25);text-align:left;vertical-align:top}
.uam td.n,.uam th.n{text-align:right;white-space:nowrap}.uam-scroll{overflow-x:auto}.uam details{margin-top:6px;font-size:.85em}.uam summary{cursor:pointer}`;
    const el = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) v !== undefined && v !== null && n.setAttribute(k, v); n.append(...kids.filter(k => k !== null && k !== undefined)); return n; };
    const svg = (tag, attrs = {}, title) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (title) n.append(Object.assign(document.createElementNS(NS, 'title'), { textContent: title })); return n; };
    const safeURL = url => { try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; } };
    const range = (a, b) => a === b ? String(a) : `${a}–${b}`;

    // Charts are plain SVG with native tooltips; tables of numbers sit in a collapsed <details>.
    // Charts are drawn at the card's real width (1 unit = 1 px), so labels stay small instead of scaling up.
    let W = 320;
    const H = 150, L = 30, B = 22, T = 8, R = 6;
    const chartWidth = mount => { const w = mount.clientWidth || 640; return Math.max(220, Math.round((w >= 594 ? (w - 14) / 2 : w) - 30)); };
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
        if (reference !== null) s.append(svg('line', { x1: L, x2: W - R, y1: y(reference), y2: y(reference), stroke: 'currentColor', 'stroke-dasharray': '4 3', 'stroke-opacity': .55 }, S.reference(reference)));
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
                if (h > 0) s.append(svg('rect', { x: L + slot * i + slot * .12, y: top - h, width: slot * .76, height: h, fill: colors[j].c, 'fill-opacity': colors[j].o }, `${r[0]} · ${name}: ${S.of(num(r[j + 2]), num(r[1]))}`));
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
            s.append(svg('rect', { x: 110, y: y + 3, width: Math.max(w, 1), height: 13, rx: 1.5, fill: 'var(--uam-accent)' }, `${name}: ${num(value)}${S.worksUnit}`));
            s.append(Object.assign(svg('text', { x: 114 + w, y: y + 13 }), { textContent: num(value) }));
        });
        return s;
    }
    const numbers = (head, rows) => { const d = el('details', {}, el('summary', {}, S.numbers)), t = el('table'), tr = el('tr'); head.forEach((h, i) => tr.append(el('th', { class: i ? 'n' : '' }, h))); t.append(el('thead', {}, tr)); const b = el('tbody'); rows.forEach(r => { const row = el('tr'); r.forEach((v, i) => row.append(el('td', { class: i ? 'n' : '' }, String(v)))); b.append(row); }); t.append(b); d.append(el('div', { class: 'uam-scroll' }, t)); return d; };
    const card = (title, note, ...body) => el('div', { class: 'uam-card' }, el('h4', {}, title), note ? el('p', { class: 'uam-note' }, note) : null, ...body);

    function metricSection(data, host, year, mount) {
        const pick = kind => data.series[kind].find(r => r.year === year), box = el('div');
        const select = el('select', { 'aria-label': S.metricYear });
        for (const y of [...data.years].reverse()) select.append(el('option', { value: y }, `${y}${y === data.snapshot_year ? S.running : ''}`));
        select.value = year;
        select.onchange = () => {
            W = chartWidth(mount);
            setLanguage(mount.dataset.uamLang);
            mount.dataset.uamYear = select.value;
            const next = metricSection(data, el('div'), Number(select.value), mount);
            host.replaceWith(next);
            next.querySelector('select').focus();
        };
        box.append(el('p', {}, el('label', {}, S.metricYear + ' ', select)));
        const grid = el('div', { class: 'uam-grid' });
        for (const kind of ['four_year', 'two_year']) {
            const four = kind === 'four_year', r = pick(kind), dl = el('dl', {}, el('dt', {}, four ? S.fourNum : S.twoNum), el('dd', {}, num(r.numerator)),
                el('dt', {}, four ? S.fourDen : S.twoDen), el('dd', {}, num(r.denominator)));
            grid.append(card(S[kind], four ? S.fourNote : S.twoNote,
                el('div', { class: 'uam-value' }, dec(r.value)), dl, el('p', { class: 'uam-note' }, S.windows(range(r.publication_from, r.publication_to), range(r.citation_from, r.citation_to), r.status === 'provisional')),
                r.small_base ? el('p', { class: 'uam-warn' }, S.smallBase) : null));
        }
        for (const kind of ['four_year', 'two_year']) {
            const rows = data.series[kind].map(r => ({ x: r.year, y: r.value }));
            grid.append(card(S.timeline(S[kind]), null, lineChart(rows, { label: S.timeline(S[kind]), highlight: year }), numbers([S.year, S.value], rows.map(r => [r.x, dec(r.y)]))));
        }
        const f = pick('fwci');
        grid.append(card(S.fwci, S.fwciNote(year), el('div', { class: 'uam-value' }, dec(f.value)),
            el('p', {}, S.fwciCover(num(f.denominator), num(f.total_documents), pct(f.coverage))),
            f.window_incomplete ? el('p', { class: 'uam-warn' }, S.fwciWindow(year, year + 3)) : null,
            f.small_base ? el('p', { class: 'uam-warn' }, S.fwciSmall) : null,
            el('p', { class: 'uam-note' }, S.fwciDef)));
        const fr = data.series.fwci.map(r => ({ x: r.year, y: r.value }));
        grid.append(card(S.timelineFwci, S.fwciDash, lineChart(fr, { label: S.timelineFwci, reference: 1, highlight: year }), numbers([S.year, 'FWCI'], fr.map(r => [r.x, dec(r.y)]))));
        const c = data.citations, w = c.three_year.find(r => r.year === year), span = range(w.from, w.to);
        grid.append(card(S.perYear, S.perYearNote(data.snapshot_year),
            barChart(c.by_year.map(r => ({ x: `${r.year}${r.partial ? '*' : ''}`, y: r.citations, year: r.year })), { label: S.perYear, unit: S.citations, highlight: r => r.year >= w.from && r.year <= w.to }),
            el('dl', {}, el('dt', {}, S.total(span)), el('dd', { 'data-uam': 'all' }, num(w.citations)), el('dt', {}, S.totalRecent(span)), el('dd', { 'data-uam': 'recent' }, num(w.recent_citations))),
            el('p', { class: 'uam-note' }, S.recentNote(num(w.recent_documents), span))));
        const years = data.types.rows.map(r => ({ x: r[0], y: r[1] }));
        grid.append(card(S.output, S.outputNote, barChart(years, { label: S.output, unit: S.worksUnit }), numbers([S.year, S.works], years.map(r => [r.x, num(r.y)]))));
        box.append(grid);
        host.append(box);
        return host;
    }

    function render(mount, data) {
        W = chartWidth(mount);
        setLanguage(mount.dataset.uamLang);
        const j = data.journal, k = data.kpis, root = el('div', { class: 'uam', lang: S.locale.slice(0, 2) });
        const meta = [j.issn.length ? 'ISSN ' + j.issn.join(', ') : null, j.doaj === null ? null : `DOAJ: ${j.doaj ? S.yes : S.no}`, j.apc_usd === null ? null : S.apc(num(j.apc_usd))].filter(Boolean).join(' · ');
        root.append(el('p', { class: 'uam-note' }, `${meta ? meta + ' · ' : ''}${S.updated(new Intl.DateTimeFormat(S.locale, { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(data.updated_at)))}`));
        const kpis = el('div', { class: 'uam-grid uam-kpis' }), [kp, kc, ko, ki, kf, kt] = S.kpis;
        for (const [label, value, note] of [[kp[0], num(k.publications), kp[1]], [kc[0], num(k.citations), kc[1]], [ko[0], pct(k.oa), ko[1]],
            [ki[0], pct(k.international), ki[1]], [kf[0], dec(k.fwci), kf[1](num(k.fwci_n), pct(k.fwci_coverage))], [kt[0], num(k.top10), kt[1](num(k.eligible))]])
            kpis.append(el('div', { class: 'uam-card' }, el('small', {}, label), el('div', { class: 'uam-value' }, value), el('small', {}, note)));
        root.append(kpis, el('h3', {}, S.impact));
        root.append(metricSection(data, el('div'), data.years.includes(Number(mount.dataset.uamYear)) ? Number(mount.dataset.uamYear) : data.default_year, mount));
        const grid = el('div', { class: 'uam-grid' });
        grid.append(card(S.types, null, ...stackedChart(data.types.rows, data.types.names, { label: S.types })),
            card(S.access, S.accessNote, ...stackedChart(data.access.rows, data.access.names, { label: S.access, percent: true })),
            card(S.countries, S.countriesNote, hbar(data.countries, { label: S.countries })));
        const o = data.origin, total = o.unand + o.external, share = total ? o.unand / total * 100 : 0, bar = svg('svg', { viewBox: `0 0 ${W} 26`, role: 'img', 'aria-label': S.origin });
        bar.append(svg('rect', { x: 0, y: 4, width: W * share / 100, height: 18, fill: 'var(--uam-accent)' }, `${S.unand}: ${num(o.unand)}${S.worksUnit}`), svg('rect', { x: W * share / 100, y: 4, width: W * (1 - share / 100), height: 18, fill: 'currentColor', 'fill-opacity': .25 }, `${S.external}: ${num(o.external)}${S.worksUnit}`));
        grid.append(card(S.origin, S.originNote, bar,
            el('dl', {}, el('dt', {}, S.unand), el('dd', {}, `${num(o.unand)} (${pct(share)})`), el('dt', {}, S.external), el('dd', {}, `${num(o.external)} (${pct(total ? 100 - share : null)})`))));
        root.append(grid, el('h3', {}, S.articles));
        const table = el('table'), head = el('tr'), body = el('tbody');
        S.columns.forEach((h, i) => head.append(el('th', { class: i === 1 || i === 2 ? 'n' : '' }, h)));
        for (const a of data.articles) {
            const url = safeURL(a.doi), title = url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, a.title) : a.title;
            body.append(el('tr', {}, el('td', {}, title), el('td', { class: 'n' }, a.year ?? '—'), el('td', { class: 'n' }, num(a.citations)), el('td', {}, a.oa || '—')));
        }
        table.append(el('thead', {}, head), body);
        root.append(el('div', { class: 'uam-scroll' }, table), el('p', { class: 'uam-note' }, S.footer(num(data.articles.length))));
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
        mount.dataset.uamLang = languageOf(mount);
        setLanguage(mount.dataset.uamLang);
        mount.style.setProperty('--uam-accent', accent(mount));
        mount.textContent = S.loading;
        try {
            const response = await fetch(new URL(`data/journals/${id}.json`, base), { mode: 'cors' });
            if (!response.ok) throw new Error();
            const data = await response.json();
            if (data.schema_version !== 1 || data.journal?.id !== id) throw new Error();
            render(mount, data);
            // Redraw when the content column width changes noticeably (e.g. rotating a phone).
            let last = mount.clientWidth;
            if (window.ResizeObserver) new ResizeObserver(() => { const w = mount.clientWidth; if (Math.abs(w - last) > 40) { last = w; render(mount, data); } }).observe(mount);
        } catch { setLanguage(mount.dataset.uamLang); mount.textContent = S.failed; }
    }
    function start() {
        if (!document.getElementById('uam-style')) document.head.append(Object.assign(document.createElement('style'), { id: 'uam-style', textContent: CSS }));
        // Text placeholders survive editors that strip scripts and data attributes.
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), hits = [];
        const pattern = /\[unand-metrics\s+(S\d{1,15})(?:\s+(en|id))?\]/i;
        while (walker.nextNode()) if (pattern.test(walker.currentNode.nodeValue)) hits.push(walker.currentNode);
        for (const node of hits) {
            const [, id, lang] = node.nodeValue.match(pattern), mount = el('div', { 'data-unand-journal': id.toUpperCase(), 'data-lang': lang ? lang.toLowerCase() : null });
            const block = node.parentElement && node.parentElement.textContent.trim() === node.nodeValue.trim() && node.parentElement !== document.body ? node.parentElement : null;
            if (block) block.replaceWith(mount); else node.replaceWith(mount);
        }
        document.querySelectorAll('[data-unand-journal]').forEach(mountWidget);
    }
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
