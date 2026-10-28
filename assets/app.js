/*! Copyright (c) 2026 Ikhwan Arief (ikhwan[at]eng.unand.ac.id). All rights reserved.
 * Licensed under the PolyForm Noncommercial License 1.0.0
 * (https://polyformproject.org/licenses/noncommercial/1.0.0). Commercial use requires prior
 * written permission from the copyright holder. See LICENSE and NOTICE. */
import { MODULES, SDGS, SDG_COLORS, METRIC_KINDS, languageName, csvCell, metricDrill, journalWindow, snapshotYearOf, withoutPeriod, workSdgs, citingShard, CITING_FIELDS } from './metrics.js';
import { renderImpactMetrics, renderJournalRecap, renderJournalHeader, renderAuthorHeader, renderJournalMetrics, renderJournalCitations, renderJournalTable, METRIC_TITLES, metricYear } from './journal-panel.js';
import { EXPORT_CONTROLS, SHOW_AUDIT_TAB, CONTENT_PROTECTION } from './config.js';
import { el, panel, bar, line, donut, stacked, scatter, hIndexCurve, heatmap, treemap, network, dots, smallMultiples, countryBubbleMap, destroyCharts, downloadText, PALETTE, sdgBars, setSJR, sjrBadge, sjrName, sjrEdition } from './charts.js';
const $ = id => document.getElementById(id), nf = new Intl.NumberFormat('id-ID'), df = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const num = n => n === null || n === undefined ? 'Tidak tersedia' : nf.format(n);
const decimal = n => n === null || n === undefined ? 'Tidak tersedia' : df.format(n);
const pct = n => n === null || n === undefined ? 'Tidak tersedia' : decimal(n) + '%';
const scopeName = { all: 'Seluruh karya terkait Unand', affiliated: 'Karya berafiliasi Unand', funded: 'Karya yang didanai Unand', published: 'Karya terbitan penerbit Unand' };
const descriptions = { overview: 'Keluaran penelitian, dampak, dan jejaring Universitas Andalas dalam satu pandangan.',
    publications: 'Telusuri karya ilmiah dan temukan publikasi di balik setiap indikator.', authors: 'Profil kontribusi penulis berdasarkan afiliasi pada karya yang teramati.',
    citations: 'Memahami sebaran sitasi dan dampak penelitian dengan cakupan yang dapat diperiksa.', collaboration: 'Menelusuri keterhubungan institusi, negara, dan sektor melalui publikasi bersama.',
    topics: 'Bidang penelitian, konsentrasi tema, dan perubahan fokus dari waktu ke waktu.', sdgs: 'Memetakan portofolio penelitian terhadap tujuan pembangunan berkelanjutan.',
    oa: 'Mengamati keterbukaan akses dan jalur distribusi pengetahuan.', funding: 'Menelusuri pendana dan keluaran penelitian yang didukung Universitas Andalas.',
    journals: 'Profil sumber terpetakan di bawah penerbit Universitas Andalas.', repositories: 'Ketersediaan salinan, format dokumen, dan kelengkapan metadata.',
    audit: 'Membaca kualitas, cakupan, dan batas interpretasi data secara transparan.' };
let manifest, history = [], currentModule = 'overview', filter = {}, data, worker, requestID = 0, renderID = 0, tablePage = 0, tableSort = 'citations';
let topicGroup = '', topicSubfield = '';
let geographyPromise;
let journalDataset, journalDatasetPromise;
const pending = new Map(), overviewCache = new Map();
// Neutral tabs default to every Unand-related work on the full corpus; research-output tabs keep Unand affiliation.
const NEUTRAL_MODULES = new Set(['publications', 'oa', 'repositories']);
const defaultScope = module => NEUTRAL_MODULES.has(module) ? 'all' : module === 'journals' ? 'published' : module === 'funding' ? 'funded' : 'affiliated';
const defaultCorpus = module => NEUTRAL_MODULES.has(module) ? 'all' : 'core';
const moduleDefaults = module => ({ ...manifest.default_filter, scope: defaultScope(module), corpus: defaultCorpus(module) });
const corpusName = corpus => corpus === 'core' ? 'Korpus utama' : 'Seluruh korpus';
const icons = ['◈', '▤', '♙', '↗', '⌘', '▦', '◎', '◉', '◇', '▥', '▱', '◌'];
async function getJSON(url) { const response = await fetch(url); if (!response.ok)
    throw new Error('Snapshot belum tersedia atau tidak dapat dibaca.'); return response.json(); }
function note(message, error = false) { $('notice').replaceChildren(); if (message)
    $('notice').append(el('div', { class: 'notice' + (error ? ' error' : '') }, message)); }
function safeURL(value) { try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
}
catch {
    return null;
} }
function external(label, url) { const safe = safeURL(url); return safe ? el('a', { href: safe, target: '_blank', rel: 'noopener noreferrer' }, label) : el('span', {}, label); }
function setHash(module, next = filter) { const p = new URLSearchParams(); for (const [k, v] of Object.entries(next))
    if (v !== '' && v !== null && v !== undefined)
        p.set(k, v); const hash = module + (p.size ? '?' + p : '');
    if (location.hash.slice(1) !== hash) $('content').setAttribute('aria-busy', 'true');
    location.hash = hash; }
const journalPage = () => currentModule === 'journals' && Boolean(filter.journal);
const currentJournal = () => journalPage() ? journalDataset?.journals.find(j => j.id === filter.journal) : null;
// Halaman profil penulis (#authors?author=A…): seluruh karya dalam snapshot yang mencantumkan penulis itu.
const authorPage = () => currentModule === 'authors' && Boolean(filter.author);
const openAuthor = (author, extra = {}) => setHash('authors', { author, ...extra });
// Drills stay inside a journal or author page; on the journals overview a Unand journal opens its own page.
function drill(patch) {
    if (journalPage()) return setHash('journals', { ...filter, ...patch });
    if (authorPage()) return setHash('authors', { ...filter, ...patch });
    if (currentModule === 'journals' && patch.source && journalDataset?.journals.some(j => j.id === patch.source)) {
        const { source, ...rest } = patch;
        return setHash('journals', { journal: source, ...rest });
    }
    setHash('publications', { ...filter, ...patch });
}
function readRoute() {
    const [route, query = ''] = location.hash.slice(1).split('?');
    currentModule = MODULES.some(([id]) => id === route) && (route !== 'audit' || SHOW_AUDIT_TAB) ? route : 'overview';
    const allowed = new Set(['from', 'to', 'scope', 'corpus', 'type', 'language', 'license', 'version', 'locationType', 'local', 'field', 'topic', 'oa', 'author', 'partner', 'country', 'funder', 'award', 'source', 'sdg', 'design', 'bin', 'audit', 'metric', 'dateQuality', 'fwciQuality', 'q', 'journal', 'metricYear', 'metricKind', 'metricPart']);
    filter = moduleDefaults(currentModule);
    for (const [k, v] of new URLSearchParams(query))
        if (allowed.has(k))
            filter[k] = v;
    if (!['all', 'affiliated', 'funded', 'published'].includes(filter.scope))
        filter.scope = defaultScope(currentModule);
    if (!['core', 'all'].includes(filter.corpus))
        filter.corpus = defaultCorpus(currentModule);
    if (!filter.to || Number(filter.to) > Number(manifest.default_filter.to))
        filter.to = manifest.default_filter.to;
    // A journal page has one fixed population: works published by that journal, full corpus.
    if (currentModule === 'journals' && filter.journal) Object.assign(filter, { scope: 'published', corpus: 'all', source: filter.journal });
    else delete filter.journal;
    // Halaman penulis juga memiliki satu populasi tetap: seluruh karya yang mencantumkan penulis, semua cakupan, seluruh korpus.
    if (authorPage()) Object.assign(filter, { scope: 'all', corpus: 'all' });
    if (currentModule !== 'publications' && !journalPage()) { delete filter.metricKind; delete filter.metricPart; }
}
function task(action, options = {}) {
    if (!worker) {
        worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data: message }) => { const item = pending.get(message.id); if (!item)
            return; pending.delete(message.id); message.error ? item.reject(new Error(message.error)) : item.resolve(message.result); };
        worker.onerror = () => { for (const item of pending.values())
            item.reject(new Error('Pengolahan snapshot gagal. Muat ulang halaman.')); pending.clear(); worker.terminate(); worker = null; };
    }
    return new Promise((resolve, reject) => { const id = ++requestID; pending.set(id, { resolve, reject }); worker.postMessage({ id, action, filter: { ...filter }, options, manifest, history }); });
}
function isDefault() { const baseline = { ...manifest.default_filter, scope: filter.scope, corpus: filter.scope === 'all' ? 'all' : 'core' }; return Object.entries(filter).filter(([k]) => k !== 'metricYear').every(([k, v]) => !v || String(v) === String(baseline[k] ?? '')) && ['from', 'to', 'scope', 'corpus'].every(k => String(filter[k]) === String(baseline[k])); }
async function getSummary() { if (isDefault()) {
    const scope = filter.scope;
    if (!overviewCache.has(scope))
        overviewCache.set(scope, await getJSON(manifest.files.overviews[scope].path));
    return overviewCache.get(scope);
} return task('summary', { ratios: currentModule === 'citations' }); }
function option(select, value, label) { select.append(el('option', { value }, label)); }
async function getJournalDataset() {
    if (!manifest.files.journal_metrics) return null;
    if (!journalDatasetPromise) journalDatasetPromise = getJSON(manifest.files.journal_metrics.path).then(result => {
        if (result.schema_version !== 1 || result.updated_at !== manifest.updated_at || result.policy?.version !== 1 ||
            !Array.isArray(result.journals) || !Array.isArray(result.years)) throw new Error('Dataset metrik jurnal tidak sesuai snapshot.');
        return result;
    }).catch(error => { journalDatasetPromise = undefined; throw error; });
    return journalDatasetPromise;
}
function openJournal(journal, year) { setHash('journals', { journal, metricYear: year }); }
function periodLabel() {
    if (!filter.from && !filter.to) return 'Semua tahun';
    if (!filter.from) return `Sampai ${filter.to}`;
    if (!filter.to) return `Sejak ${filter.from}`;
    return `${filter.from}–${filter.to}`;
}
function syncFilters() {
    const lastYear = Math.max(Number(manifest.default_filter.to), filter.metricKind ? Number(filter.to) : 0);
    const availableYears = [...manifest.dataset_years, lastYear, filter.from, filter.to]
        .map(Number).filter(year => Number.isInteger(year) && year >= 1500 && year <= lastYear);
    const firstYear = Math.min(...availableYears);
    for (const key of ['from', 'to', 'scope', 'corpus', 'type', 'field', 'oa']) {
        const field = $('filter-' + key);
        if (key === 'from' || key === 'to') {
            field.replaceChildren();
            if (key === 'from') option(field, '', 'Semua tahun');
            for (let year = lastYear; year >= firstYear; year--)
                option(field, year, `${year}${year === data.current_year ? ' (berjalan)' : ''}`);
        }
        if (['type', 'field'].includes(key)) {
            field.replaceChildren();
            option(field, '', key === 'type' ? 'Semua jenis' : 'Semua bidang');
            for (const row of data.facets[key === 'type' ? 'types' : 'fields'])
                option(field, row.id, row.name);
            if (filter[key] && ![...field.options].some(o => o.value === filter[key]))
                option(field, filter[key], filter[key]);
        }
        field.value = filter[key] ?? '';
    }
    $('active-filters').replaceChildren();
    const labels = { topic: 'Topik', author: 'Penulis', partner: 'Mitra', country: 'Negara', funder: 'Pendana', award: 'Hibah', source: 'Sumber', sdg: 'SDG', design: 'Desain studi', language: 'Bahasa', license: 'Lisensi', version: 'Versi', locationType: 'Lokasi', local: 'Afiliasi Unand', bin: 'Rentang sitasi', audit: 'Audit', metric: 'Indikator', dateQuality: 'Tanggal layak timeline', fwciQuality: 'Kelayakan FWCI', q: 'Pencarian' };
    $('filter-scope').disabled = $('filter-corpus').disabled = journalPage() || authorPage();
    for (const [key, label] of Object.entries(labels))
        if (filter[key] !== undefined && filter[key] !== '' && !(key === 'source' && journalPage()) && !(key === 'author' && authorPage())) {
            const chip = el('span', { class: 'chip' }, `${label}: ${key === 'language' ? languageName(filter[key]) : filter[key]}`), button = el('button', { type: 'button', 'aria-label': `Hapus filter ${label}` }, '×');
            button.onclick = () => { const next = { ...filter }; delete next[key]; setHash(currentModule, next); };
            chip.append(button);
            $('active-filters').append(chip);
        }
}
function kpis(container) {
    const k = data.kpis, grid = el('div', { class: 'kpi-grid' });
    const rows = [['Publikasi', num(k.publications), 'Karya unik dalam filter aktif', '', data.top.years.map(r => r.count)],
        ['Sitasi kumulatif', num(k.citations), 'Sitasi pada karya terpilih; per tanggal snapshot', '', data.citation_years.map(r => r[1])],
        ['Open access', pct(k.oa), 'Karya yang dapat dibaca secara terbuka', 'oa', data.oa_years.map(r => r.total ? Object.entries(r.oa).filter(([key]) => key !== 'closed').reduce((n, [, v]) => n + v, 0) / r.total : 0)],
        ['Kolaborasi internasional', pct(k.international), 'Lebih dari satu negara afiliasi dikenali', 'international', data.oa_years.map(r => r.total ? r.international / r.total : 0)],
        ['Rerata FWCI', decimal(k.fwci), `Tersedia pada ${num(k.fwci_n)} karya · ${pct(k.fwci_coverage)}`, 'fwci', []],
        ['Karya top 10 persen', k.eligible ? num(k.top10) : 'Tidak tersedia', `${pct(k.top10_share)} dari ${num(k.eligible)} karya bermetrik`, 'top10', []]];
    for (const [label, value, foot, metric, series] of rows) {
        const card = el('article', { class: 'kpi' });
        card.append(el('div', { class: 'kpi-label' }, label), el('div', { class: 'kpi-value' }, value), el('div', { class: 'kpi-foot' }, foot));
        if (metric === 'fwci') fwciHelp(card);
        const link = el('button', { class: 'kpi-link', type: 'button', 'aria-label': `Lihat karya untuk ${label}` }, '↗');
        link.onclick = () => drill({ metric });
        card.append(link);
        if (series.length > 1) {
            const max = Math.max(...series, 1), min = Math.min(...series, 0), points = series.map((n, i) => `${i / (series.length - 1) * 70},${22 - (n - min) / (max - min || 1) * 20}`).join(' '), svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 72 24');
            svg.setAttribute('class', 'sparkline');
            svg.setAttribute('aria-hidden', 'true');
            const poly = document.createElementNS(svg.namespaceURI, 'polyline');
            poly.setAttribute('points', points);
            poly.setAttribute('fill', 'none');
            poly.setAttribute('stroke', PALETTE[0]);
            poly.setAttribute('stroke-width', '1.8');
            svg.append(poly);
            card.append(svg);
        }
        grid.append(card);
    }
    container.append(grid);
}
function minis(container, rows) { const grid = el('div', { class: 'mini-stats' }); for (const [label, value, note] of rows) {
    const c = el('div', { class: 'mini-stat' });
    c.append(el('span', {}, label), el('strong', {}, value), el('small', {}, note || ''));
    if (label.includes('FWCI')) fwciHelp(c);
    grid.append(c);
} container.append(grid); }
function fwciHelp(container, { open = false, work = false, timeline = false } = {}) {
    const details = el('details', { class: 'fwci-help' });
    details.open = open;
    details.append(el('summary', {}, 'Arti FWCI dan cara pengukuran'),
        el('p', {}, 'FWCI (Field-Weighted Citation Impact) mengukur dampak sitasi karya dengan memperhitungkan bidang, tahun, dan jenis publikasinya.'),
        el('p', {}, 'FWCI per karya = sitasi diterima ÷ sitasi yang diharapkan. Pembandingnya adalah rerata sitasi karya OpenAlex dengan tahun, jenis, dan subbidang yang sama. Jendela hitung mencakup tahun publikasi dan tiga tahun berikutnya; jumlah sitasi kumulatif dapat memakai rentang berbeda.'),
        el('p', {}, 'FWCI 1 = rerata pembanding global; 2 = dua kali; 0,5 = separuhnya. Tahun terbaru memiliki jendela sitasi yang belum penuh.'));
    if (!work) details.append(el('p', {}, `Rerata FWCI dashboard = jumlah skor FWCI valid ÷ jumlah karya dengan FWCI valid dalam filter dan kelompok yang ditampilkan. Cakupan FWCI = jumlah karya bermetrik ÷ seluruh karya${timeline ? ' yang layak tanggal pada tahun tersebut' : ' dalam kelompok yang sama'} × 100%. Nilai 0 dihitung; nilai kosong tidak dianggap 0.`));
    details.append(el('p', {}, 'Skor per karya diambil dari OpenAlex; dashboard tidak menghitung ulang pembanding global. Ini metrik karya, bukan skor jurnal.'),
        external('Metode FWCI OpenAlex ↗', 'https://help.openalex.org/data/works/citations/'));
    container.append(details);
}
function intro(container, text) { container.append(el('div', { class: 'module-intro' }, text)); }
function years() { return data.top.years.filter(r => Number.isFinite(Number(r.id))).map(r => Number(r.id)); }
function groupedYears(kind) { return years().map(year => ({ year, total: data.top.years.find(r => Number(r.id) === year)?.count || 0, values: Object.fromEntries(data.top[kind].map(r => [r.id, r.years[year] || 0])) })); }
function groupBar(grid, title, kind, key, noteText = '', limit = 10) { const p = panel(grid, title, noteText); bar(p, kind === 'sources' ? data.top[kind].map(r => ({ ...r, name: sjrName(r.id, r.name) })) : data.top[kind], { limit, onClick: r => drill({ [key]: r.id }) }); return p; }
function pubTable(container, rows = data.publications, total = data.total, { candidate = false } = {}) {
    const section = el('section', { class: 'panel table-panel publication-table' }), head = el('div', { class: 'panel-head' }), label = el('div');
    label.append(el('h2', {}, candidate ? 'Kandidat afiliasi untuk ditinjau' : 'Publikasi di balik angka'), el('p', {}, candidate ? 'Kandidat berbasis teks; belum dinyatakan sebagai karya Unand.' : `${num(total)} karya sesuai cakupan · klik judul untuk rincian`));
    if (!candidate && sjrEdition()) {
        const sjrNote = el('p', {}, `Label Q1–Q4 di samping nama jurnal: kuartil terbaik (SJR Best Quartile) edisi ${sjrEdition()}, dipakai untuk semua tahun terbit. Jurnal tanpa kuartil tidak diberi label. Sumber: `);
        sjrNote.append(external('SCImago Journal & Country Rank ↗', 'https://www.scimagojr.com'), document.createTextNode('.'));
        label.append(sjrNote);
    }
    head.append(label);
    section.append(head);
    if (!candidate) {
        const toolbar = el('div', { class: 'table-toolbar' }), search = el('input', { class: 'search-input', type: 'search', placeholder: 'Cari judul, DOI, atau penulis · tekan Enter', 'aria-label': 'Cari publikasi' });
        search.value = filter.q || '';
        search.onkeydown = e => { if (e.key === 'Enter') {
            e.preventDefault();
            drill({ q: search.value.trim() });
        } };
        const sort = el('select', { 'aria-label': 'Urutkan publikasi' });
        for (const [v, l] of [['citations', 'Sitasi tertinggi'], ['year', 'Tahun terbaru'], ['title', 'Judul A–Z']])
            option(sort, v, l);
        sort.value = tableSort;
        sort.onchange = () => { tableSort = sort.value; tablePage = 0; loadTable(section); };
        toolbar.append(search, sort);
        section.append(toolbar);
    }
    const tableWrap = el('div', { class: 'table-scroll' }), table = el('table'), thead = el('thead'), tr = el('tr');
    const columns = [['Publikasi', ''], ['Tahun', 'num'], ...(filter.metricKind ? [[filter.metricKind === 'fwci' ? 'FWCI karya' : 'Sitasi dalam jendela', 'num']] : []), ['Sitasi kumulatif', 'num'], ['Akses', '']];
    for (const [text, cls] of columns)
        tr.append(el('th', { scope: 'col', class: cls }, text));
    thead.append(tr);
    table.append(thead);
    const tbody = el('tbody');
    table.append(tbody);
    tableWrap.append(table);
    section.append(tableWrap);
    function renderRows(items) {
        tbody.replaceChildren();
        for (const row of items) {
            const tr = el('tr'), title = el('td'), button = el('button', { class: 'work-title', type: 'button', 'data-work-id': row.id }, row.title);
            button.onclick = () => openWork(row.id);
            title.append(button);
            if (row.source_name) {
                const source = el('span', { class: 'work-source' }, row.source_name), badge = sjrBadge(row.source);
                if (badge) source.append(' ', badge);
                title.append(source);
            }
            if (row.retracted)
                title.append(el('span', { class: 'warning-tag' }, 'Flag retraksi · perlu telaah konteks'));
            const access = el('td');
            access.append(el('span', { class: `oa-tag ${row.oa_status === 'closed' ? 'closed' : ''}` }, row.oa_status || 'Kandidat audit'));
            tr.append(title, el('td', { class: 'num' }, row.year || '—'));
            if (filter.metricKind) tr.append(el('td', { class: 'num journal-contribution' }, filter.metricKind === 'fwci' ? decimal(row.journal_citations) : num(row.journal_citations)));
            tr.append(el('td', { class: 'num' }, row.citations === undefined ? '—' : num(row.citations)), access);
            tbody.append(tr);
        }
        if (!items.length) {
            const td = el('td', { colspan: columns.length }, 'Tidak ada publikasi pada filter ini.');
            const row = el('tr');
            row.append(td);
            tbody.append(row);
        }
    }
    renderRows(rows);
    const pagination = el('div', { class: 'pagination' }), count = el('span', {}, candidate ? `${num(rows.length)} kandidat ditampilkan` : `${total?1:0}–${Math.min(50, total)} dari ${num(total)}`), buttons = el('div');
    if (!candidate) {
        const prev = el('button', { type: 'button' }, '← Sebelumnya'), next = el('button', { type: 'button' }, 'Berikutnya →');
        prev.disabled = true;
        next.disabled = total <= 50;
        prev.onclick = () => { tablePage = Math.max(0, tablePage - 1); loadTable(section); };
        next.onclick = () => { tablePage++; loadTable(section); };
        buttons.append(prev, next);
        section.tableControls = { prev, next, count };
    }
    pagination.append(count, buttons);
    section.append(pagination);
    section.renderRows = renderRows;
    container.append(section);
    return section;
}
async function loadTable(section) { note('Memuat rincian snapshot untuk penelusuran…'); try {
    const page = await task('page', { page: tablePage, sort: tableSort });
    if (!section.isConnected)
        return;
    section.renderRows(page.rows);
    const c = section.tableControls;
    c.prev.disabled = tablePage === 0;
    c.next.disabled = (tablePage + 1) * 50 >= page.total;
    c.count.textContent = `${page.total ? tablePage * 50 + 1 : 0}–${Math.min((tablePage + 1) * 50, page.total)} dari ${num(page.total)}`;
    note('');
}
catch (e) {
    note(e.message, true);
} }
function selectors(container) {
    const configs = {
        authors: [['author', 'Penulis Unand', data.top.authors]], collaboration: [['partner', 'Institusi mitra', data.top.partners], ['country', 'Negara', data.top.countries]],
        topics: [['topic', 'Topik terpetakan', data.facets.topics]], sdgs: [['sdg', 'Tujuan SDG', Array.from({ length: 17 }, (_, i) => ({ id: String(i + 1), name: `SDG ${i + 1} · ${SDGS[i]}` }))]],
        funding: [['funder', 'Pendana', data.top.funders], ['award', 'Hibah', data.top.awards]],
        publications: [['topic', 'Topik terpetakan', data.facets.topics], ['source', 'Sumber', data.top.sources]],
        audit: [['audit', 'Jenis pemeriksaan', [{ id: 'doi', name: 'Tanpa DOI' }, { id: 'abstract', name: 'Tanpa abstrak' }, { id: 'source', name: 'Sumber tidak diketahui' }, { id: 'date', name: 'Tanggal tidak wajar' }, { id: 'affiliation', name: 'Afiliasi belum lengkap' }, {id:'author_id',name:'Penulis tanpa ID profil'}, { id: 'retracted', name: 'Flag retraksi' }]]],
    };
    const list = configs[currentModule];
    if (!list)
        return;
    const form = el('form', { class: 'table-toolbar' });
    for (const [key, label, rows] of list) {
        if (key === 'topic') {
            topicSelector(form, rows);
            continue;
        }
        const input = el('select', { 'aria-label': label });
        option(input, '', `Semua · ${label}`);
        for (const r of rows)
            option(input, r.id, r.name);
        input.value = filter[key] || '';
        input.onchange = () => setHash(currentModule, { ...filter, [key]: input.value });
        form.append(input);
    }
    container.append(form);
}
function topicSelector(form, rows) {
    const groups = new Map(), fieldNames = new Map(data.facets.fields.map(row => [row.id, row.name]));
    for (const row of rows) {
        const field = row.field || 'unknown';
        if (!groups.has(field)) groups.set(field, []);
        groups.get(field).push(row);
    }
    const groupLabel = field => fieldNames.get(field) || 'Bidang belum terpetakan';
    const activeTopic = rows.find(row => row.id === filter.topic);
    if (activeTopic) {
        topicGroup = activeTopic.field || 'unknown';
        topicSubfield = activeTopic.subfield || 'Topik lainnya';
    }
    if (!groups.has(topicGroup)) { topicGroup = ''; topicSubfield = ''; }
    const group = el('select', { id: 'topic-group', 'aria-label': 'Kelompok topik' });
    const subfield = el('select', { id: 'topic-subfield', 'aria-label': 'Subbidang topik' });
    const topic = el('select', { id: 'mapped-topic', 'aria-label': 'Topik terpetakan', 'aria-describedby': 'topic-help' });
    option(group, '', 'Pilih kelompok bidang');
    for (const [field, topics] of [...groups].sort((a, b) => groupLabel(a[0]).localeCompare(groupLabel(b[0]), 'id')))
        option(group, field, `${groupLabel(field)} (${num(topics.length)} topik)`);
    group.value = topicGroup;
    function fillTopics() {
        topic.replaceChildren();
        option(topic, '', topicSubfield ? 'Pilih topik' : 'Pilih bidang dan subbidang terlebih dahulu');
        const topics = (groups.get(topicGroup) || []).filter(row => (row.subfield || 'Topik lainnya') === topicSubfield);
        for (const row of topics.sort((a, b) => a.name.localeCompare(b.name, 'id')))
            option(topic, row.id, row.name);
        if (filter.topic && !rows.some(row => row.id === filter.topic))
            option(topic, filter.topic, `Topik aktif · ${filter.topic}`);
        topic.disabled = (!topicGroup || !topicSubfield) && !filter.topic;
        topic.value = filter.topic || '';
    }
    function fillSubfields() {
        const subfields = new Map();
        for (const row of groups.get(topicGroup) || []) {
            const label = row.subfield || 'Topik lainnya';
            subfields.set(label, (subfields.get(label) || 0) + 1);
        }
        subfield.replaceChildren();
        option(subfield, '', topicGroup ? 'Pilih subbidang' : 'Pilih kelompok bidang terlebih dahulu');
        for (const [label, count] of [...subfields].sort((a, b) => a[0].localeCompare(b[0], 'id')))
            option(subfield, label, `${label} (${num(count)} topik)`);
        if (!subfields.has(topicSubfield)) topicSubfield = '';
        subfield.value = topicSubfield;
        subfield.disabled = !topicGroup;
        fillTopics();
    }
    function clearTopicOrFill() {
        if (!filter.topic) { fillSubfields(); return; }
        const next = { ...filter };
        delete next.topic;
        setHash(currentModule, next);
    }
    group.onchange = () => {
        topicGroup = group.value;
        topicSubfield = '';
        clearTopicOrFill();
    };
    subfield.onchange = () => { topicSubfield = subfield.value; clearTopicOrFill(); };
    topic.onchange = () => setHash(currentModule, { ...filter, topic: topic.value });
    fillSubfields();
    const groupLabelNode = el('label', { class: 'topic-control' }, 'Kelompok topik');
    const subfieldLabelNode = el('label', { class: 'topic-control' }, 'Subbidang');
    const topicLabelNode = el('label', { class: 'topic-control mapped-topic-control' }, 'Topik terpetakan');
    groupLabelNode.append(group);
    subfieldLabelNode.append(subfield);
    topicLabelNode.append(topic);
    form.append(groupLabelNode, subfieldLabelNode, topicLabelNode, el('small', { id: 'topic-help', class: 'topic-help' }, 'Pilih bidang, subbidang, lalu topik. Filter diterapkan setelah topik dipilih.'));
}
// The single Jurnal Unand table: dataset metrics merged with every journal's output in the active filter.
async function journalTable(content) {
    const section = el('section', { class: 'panel table-panel journal-table', 'aria-busy': 'true' });
    section.append(el('p', { class: 'panel-note' }, 'Memuat tabel jurnal…'));
    content.append(section);
    if (!journalDataset?.journals.length) { section.replaceChildren(el('p', { class: 'empty-state' }, 'Belum ada jurnal terpetakan di bawah penerbit Unand.')); section.setAttribute('aria-busy', 'false'); return; }
    const thisRender = renderID, year = metricYear(journalDataset.years, journalDataset.defaults.year, filter);
    try {
        const result = await task('entities', { kind: 'sources', pageSize: 'all' });
        if (thisRender !== renderID) return;
        renderJournalTable(section, journalDataset, year, new Map(result.rows.map(r => [r.id, r])), openJournal);
    }
    catch (error) {
        if (thisRender !== renderID) return;
        section.replaceChildren(el('p', { class: 'empty-state' }, 'Tabel jurnal belum dapat ditampilkan. Muat ulang halaman.'));
        section.setAttribute('aria-busy', 'false');
    }
}
// Context above a drill list: which metric, year and population the listed works form.
function metricContext(content, journal) {
    const kind = filter.metricKind, year = Number(filter.metricYear);
    const row = journal ? journal.series[kind].find(r => r.year === year) : data.metric_row;
    const context = el('section', { class: 'panel journal-drill-context' });
    const owner = journal ? journal.name : scopeName[filter.scope];
    context.append(el('h2', {}, `${journal && kind === 'fwci' ? 'FWCI jurnal' : METRIC_TITLES[kind]} · ${year} · ${owner}`));
    if (row) context.append(el('p', {}, kind === 'fwci'
        ? `${num(row.denominator)} karya dengan FWCI valid dari ${num(row.total_documents)} karya terbitan ${row.year}. Jumlah skor FWCI ${decimal(row.numerator)} ÷ ${num(row.denominator)} karya bermetrik = ${decimal(row.value)}.`
        : `${filter.metricPart === 'numerator' ? 'Dokumen sasaran pembilang, termasuk dokumen dengan nol sitasi' : 'Dokumen penyebut'}. ${num(row.numerator)} sitasi ÷ ${num(row.denominator)} dokumen. Periode publikasi ${row.publication_from}–${row.publication_to}; sitasi ${row.citation_from}–${row.citation_to}.`));
    context.append(el('p', {}, `Kolom ${kind === 'fwci' ? 'FWCI karya menampilkan skor pembentuk rerata' : 'Sitasi dalam jendela menunjukkan kontribusi setiap karya'}. Sitasi kumulatif dan kartu indikator umum memakai seluruh sitasi per snapshot. ${journal ? 'Daftar hanya memuat karya jurnal ini. ' : 'Daftar mengikuti cakupan dan filter yang sama dengan indikator. '}Pencarian hanya mempersempit daftar dokumen; tidak menghitung ulang nilai. Menerapkan Jelajahi data mengakhiri rincian metrik ini.`));
    if (kind === 'fwci') fwciHelp(context);
    const back = el('button', { class: 'button secondary', type: 'button' }, journal ? 'Kembali ke halaman jurnal' : 'Kembali ke Dampak sitasi');
    back.onclick = () => journal ? openJournal(journal.id, year)
        : setHash('citations', { ...withoutPeriod(filter), from: manifest.default_filter.from, to: manifest.default_filter.to, metricYear: year });
    context.append(back); content.append(context);
}
function render() {
    destroyCharts();
    const content = $('content');
    content.replaceChildren();
    content.setAttribute('aria-busy', 'false');
    const title = MODULES.find(([id]) => id === currentModule)[1];
    $('page-title').textContent = currentModule === 'overview' ? 'Ringkasan universitas' : title;
    $('page-description').textContent = descriptions[currentModule];
    document.title = title + ' · Universitas Andalas';
    document.querySelectorAll('.nav-link').forEach(a => { const active = a.dataset.module === currentModule; a.classList.toggle('active', active); active ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    syncFilters();
    const journal = currentJournal(), author = authorPage() ? data.author_profile : null;
    if (author) {
        $('page-title').textContent = author.name;
        $('page-description').textContent = 'Profil publikasi dalam dashboard riset Universitas Andalas.';
        document.title = `${author.name} · Penulis · Universitas Andalas`;
        renderAuthorHeader(content, author, () => setHash('authors', {}));
    }
    if (journal) {
        document.title = `${journal.name} · Jurnal Unand · Universitas Andalas`;
        renderJournalHeader(content, journalDataset, journal, () => setHash('journals', { metricYear: filter.metricYear }));
    }
    const scope = el('div', { class: 'scope-line' });
    scope.append(el('span', {}, `${journal ? journal.name : author ? `Karya ${author.name}` : scopeName[filter.scope]} · ${periodLabel()} · ${corpusName(filter.corpus)}`), el('strong', {}, `${num(data.total)} karya unik`));
    content.append(scope);
    if ((!filter.from || Number(filter.from) <= data.current_year) && (!filter.to || Number(filter.to) >= data.current_year))
        intro(content, `Tahun ${data.current_year} belum lengkap. Perbandingan tahun berjalan tidak disamakan dengan satu tahun kalender penuh.`);
    if (filter.scope === 'all' && !journal && !author)
        intro(content, 'Cakupan Seluruhnya menggabungkan karya berafiliasi Unand, didanai Unand, dan terbitan penerbit Unand; setiap karya dihitung sekali. Sebagian karya tidak memiliki penulis Unand, sehingga angka ini bukan ukuran keluaran riset Unand saja.');
    else if (filter.scope !== 'affiliated' && !journal && !author)
        intro(content, filter.scope === 'funded' ? 'Cakupan ini berisi karya yang mencantumkan Unand sebagai pendana. Afiliasi penulis dapat berasal dari institusi lain.' : 'Cakupan ini berisi karya terbitan sumber di bawah penerbit Unand, termasuk artikel penulis dari luar Unand.');
    kpis(content);
    if (currentModule === 'journals' && !journal)
        renderJournalRecap(content, journalDataset, filter, year => setHash('journals', { ...filter, metricYear: year }));
    if (journal && !filter.metricKind)
        renderJournalMetrics(content, journalDataset, journal, filter, { onYear: year => setHash('journals', { ...filter, metricYear: year }),
            onDrill: (kind, part, year) => setHash('journals', { ...metricDrill(year, kind, part, journal.id) }) });
    if (currentModule === 'citations') {
        const ratios = data.citation_ratios, year = metricYear(ratios.years, ratios.default_year, filter);
        renderImpactMetrics(content, ratios, { title: 'Indikator dampak sitasi', fwciTitle: 'FWCI', years: ratios.years, snapshotYear: ratios.snapshot_year, year,
            populationLabel: scopeName[filter.scope].charAt(0).toLowerCase() + scopeName[filter.scope].slice(1),
            populationText: `Populasi mengikuti cakupan aktif (${scopeName[filter.scope]}) dan filter Jelajahi data selain periode; periode publikasi ditentukan oleh jendela tahun metrik.`,
            note: `Rasio sitasi 4 tahun (pola CiteScore), rasio sitasi 2 tahun (pola JIF), dan FWCI untuk ${scopeName[filter.scope]} pada tahun metrik terpilih. Filter Jelajahi data berlaku, kecuali periode: jendela publikasi mengikuti tahun metrik. FWCI memakai pemeriksaan tanggal dan basis minimum yang sama dengan Timeline FWCI.`,
            footer: `${scopeName[filter.scope]} · ${corpusName(filter.corpus)} · Snapshot ${manifest.updated_at}`,
            onYear: next => setHash('citations', { ...filter, metricYear: next }),
            onDrill: (kind, part, metric) => kind === 'fwci' ? drill({ from: metric, to: metric, metric: 'fwci', fwciQuality: 'valid' })
                : setHash('publications', { ...withoutPeriod(filter), ...metricDrill(metric, kind, part) }) });
    }
    if (filter.metricKind) metricContext(content, journal);
    if (!journal && !author) selectors(content);
    const grid = el('div', { class: 'charts-grid' });
    content.append(grid);
    const k = data.kpis;
    const drillYear = r => drill({ from: r.id ?? r.year, to: r.id ?? r.year });
    if (currentModule === 'overview') {
        growthTimeline(grid);
        fwciTimeline(grid);
        const p = panel(grid, 'Perjalanan publikasi', 'Jumlah karya unik menurut tahun publikasi.');
        line(p, data.top.years, { onClick: drillYear });
        const q = panel(grid, 'Komposisi karya', 'Jenis dokumen mengikuti normalisasi OpenAlex.');
        stacked(q, groupedYears('types'), data.top.types.slice(0, 6), { onClick: (y, s) => drill({ from: y.year, to: y.year, type: s.id }) });
        treemap(panel(grid, 'Lanskap bidang penelitian', 'Satu bidang utama per karya; klik bidang untuk menjelajah.'), data.top.fields, r => drill({ field: r.id }));
        groupBar(grid, 'Jejaring institusi teratas', 'partners', 'partner', 'Satu karya dapat melibatkan beberapa mitra.');
        minis(content, [['Pertumbuhan ' + k.growth_year, pct(k.growth), 'Dibandingkan tahun lengkap sebelumnya'], ['Penulis Unand teramati', num(k.authors), 'Bukan jumlah dosen aktif'], ['Institusi mitra', num(k.partners), 'Berdasarkan afiliasi publikasi'], ['Karya disitasi', pct(k.cited_share), 'Minimal satu sitasi pada snapshot']]);
    }
    else if (currentModule === 'publications') {
        growthTimeline(grid);
        const annual = data.annual_fwci;
        fwciTimeline(grid);
        stacked(panel(grid, 'Jenis karya menurut tahun', 'Karya unik; jenis minor dapat berada di luar enam seri teratas.'), groupedYears('types'), data.top.types.slice(0, 6), { onClick: (y, s) => drill({ from: y.year, to: y.year, type: s.id }) });
        bar(panel(grid, 'Sebaran sitasi', 'Klik rentang untuk melihat publikasinya.'), data.histogram, { horizontal: false, onClick: r => drill({ bin: r.id }) });
        groupBar(grid, 'Sumber publikasi teratas', 'sources', 'source');
        groupBar(grid, 'Bahasa metadata', 'languages', 'language', 'Bahasa judul atau abstrak, belum tentu bahasa teks lengkap.');
        annualFWCITable(content, annual);
    }
    else if (author) {
        // Dua per baris; setiap grafik hanya memuat karya penulis ini dan klik mempersempit halaman ini.
        line(panel(grid, 'Perjalanan publikasi', 'Karya penulis menurut tahun publikasi. Klik tahun untuk mempersempit halaman ini.'), data.top.years, { onClick: drillYear });
        line(panel(grid, 'Sitasi menurut tahun diterima', 'Sitasi kepada karya penulis pada setiap tahun (counts_by_year OpenAlex); jendela tersedia terbatas.'), data.citation_years.map(([year, count]) => ({ year, count })), { label: 'Sitasi', unit: 'sitasi' });
        // Baris kedua: kurva h-index | sebaran sitasi; ketiga: jenis karya | akses; keempat: SDG | negara kolaborasi.
        const hChart = data.h_index_chart, uncited = hChart.points.filter(row => !(row.citations > 0)).length;
        const hPanel = panel(grid, 'Kurva h-index karya aktif', `h-index: ${num(hChart.value)} · ${num(hChart.works_n)} karya aktif · ${num(hChart.value)} karya dalam h-core.${uncited ? ` ${num(uncited)} karya tanpa sitasi tidak digambar.` : ''} Nilai mengikuti seluruh filter aktif.`);
        hIndexCurve(hPanel, hChart, row => openWork(row.id));
        bar(panel(grid, 'Sebaran sitasi', 'Jumlah karya per rentang sitasi. Klik rentang untuk melihat karyanya.'), data.histogram, { horizontal: false, onClick: r => drill({ bin: r.id }) });
        stacked(panel(grid, 'Jenis karya menurut tahun', 'Jenis minor dapat berada di luar enam seri teratas.'), groupedYears('types'), data.top.types.slice(0, 6), { onClick: (y, s) => drill({ from: y.year, to: y.year, type: s.id }) });
        donut(panel(grid, 'Jalur keterbukaan akses', 'Status OA karya penulis pada saat snapshot.'), data.top.oa, r => drill({ oa: r.id === 'unknown' ? '' : r.id }));
        sdgCard(grid, 'SDG karya penulis');
        collaborationMap(grid, { title: 'Negara kolaborasi', includeHome: true, unit: 'karya', wide: false,
            note: 'Negara afiliasi seluruh penulis pada karya ini, termasuk Indonesia. Luas bubble sebanding dengan jumlah karya; satu karya dapat masuk beberapa negara.' });
        groupBar(grid, 'Sumber publikasi teratas', 'sources', 'source');
        groupBar(grid, 'Bahasa metadata', 'languages', 'language', 'Bahasa judul atau abstrak, belum tentu bahasa teks lengkap.');
        treemap(panel(grid, 'Bidang penelitian', 'Satu bidang utama per karya; klik bidang untuk mempersempit halaman ini.'), data.top.fields, r => drill({ field: r.id }));
        groupBar(grid, 'Topik dominan', 'topics', 'topic', 'Satu karya dapat masuk beberapa topik.');
        groupBar(grid, 'Institusi rekan penulis', 'partners', 'partner', 'Institusi selain Unand pada karya penulis.');
        const fwciYears = data.annual_fwci.filter(r => r.count > 0);
        const fwciPanel = panel(grid, 'Rerata FWCI menurut tahun publikasi', 'Rerata skor FWCI valid karya penulis per tahun publikasi; garis putus-putus: acuan global 1. Tahun dengan sedikit karya mudah berfluktuasi.');
        line(fwciPanel, fwciYears.map(r => ({ year: r.year, value: r.fwci, n: r.fwci_n })), { value: 'value', label: 'Rerata FWCI', unit: 'FWCI', reference: 1, referenceLabel: 'Acuan global FWCI 1', color: PALETTE[3],
            tooltip: r => `${r.year}: rerata FWCI ${r.value === null ? 'tidak tersedia' : decimal(r.value)} · ${num(r.n)} karya ber-FWCI${r.n < 5 ? ' · basis kecil' : ''}`, onClick: drillYear });
        fwciHelp(fwciPanel.node);
        minis(content, [['Median sitasi', decimal(k.median_citations), 'Per karya'], ['Karya disitasi', pct(k.cited_share), 'Minimal satu sitasi'], ['Cakupan FWCI', pct(k.fwci_coverage), 'Karya dengan FWCI valid']]);
    }
    else if (currentModule === 'authors') {
        intro(content, 'Seluruh statistik pada diagram penulis dihitung dari authorship yang pada elemen yang sama berafiliasi Unand. Statistik sepanjang karier ditampilkan terpisah pada rincian.');
        bar(panel(grid, 'Penulis menurut karya berafiliasi Unand', 'Klik nama penulis untuk membuka profilnya.'), data.top.authors, { limit: 10, onClick: r => openAuthor(r.id) });
        scatter(panel(grid, 'Produktivitas dan sitasi penulis', 'Maksimum 50 penulis paling produktif dalam filter aktif. Klik penulis untuk membuka profilnya.'), data.top.authors, { onClick: r => openAuthor(r.id) });
        smallMultiples(panel(grid, 'Aktivitas penulis lintas tahun', 'Grafik garis untuk 10 penulis teratas menurut karya berafiliasi Unand. Rentang setiap penulis dimulai dan berakhir pada tahun publikasinya dalam rentang grafik terpilih; jeda di antaranya tetap bernilai nol. Skala vertikal seragam, rentang horizontal dapat berbeda. Klik titik untuk membuka profil penulis pada tahun tersebut.', true), data.top.authors, years(), (r, y) => openAuthor(r.id, { from: y, to: y }), { individual: true });
        minis(content, [['Penulis teramati', num(k.authors), 'Profil berdasarkan publikasi'], ['Memiliki ORCID', num(data.coverage.orcid_authors), 'Dari profil penulis teramati'], ['Penulis pertama Unand', num(k.first), 'Per karya; elemen authorship yang sama'], ['Corresponding Unand', num(k.corresponding), 'Kelengkapan corresponding tidak dijamin']]);
        entityTable(content, 'authors');
        intro(content,`${num(data.quality.author_id)} karya memiliki authorship tanpa OpenAlex author ID. Nama, afiliasi, dan posisi yang tersedia tetap ditampilkan; authorship tersebut tidak digabung sebagai satu profil penulis atau dihitung sebagai dosen baru.`);
    }
    else if (currentModule === 'citations') {
        fwciTimeline(grid);
        bar(panel(grid, 'Distribusi sitasi karya', 'Termasuk karya yang belum disitasi.'), data.histogram, { horizontal: false, onClick: r => drill({ bin: r.id }) });
        line(panel(grid, 'Sitasi menurut tahun teramati', 'Jumlah pada counts_by_year; jendela tersedia terbatas, bukan seluruh sejarah.'), data.citation_years.map(([year, count]) => ({ year, count })), { label: 'Sitasi teramati',unit:'sitasi' });
        scatter(panel(grid, 'Usia karya dan sitasi', 'Maksimum 250 karya paling disitasi; usia dihitung dari tahun snapshot.'), data.scatter, { x: 'age', y: 'citations', xTitle: 'Usia karya (tahun)', onClick: r => openWork(r.id) });
        bar(panel(grid, 'Kelompok dampak ternormalisasi', `Cakupan persentil: ${num(k.eligible)} karya · ${pct(k.percentile_coverage)}.`), k.eligible ? [{ id: 'top1', name: 'Top 1 persen', count: k.top1 }, { id: 'top10', name: 'Top 10 persen (termasuk top 1)', count: k.top10 }] : [], { limit: 2, onClick: r => drill({ metric: r.id }) });
        const net = panel(grid, filter.scope === 'affiliated' ? 'Hubungan antarkarya Unand' : 'Hubungan antarkarya terpilih', 'Subset maksimal 40 karya paling disitasi; hubungan berupa referensi yang teramati.', true);
        const select = el('select', { 'aria-label': 'Jenis jejaring sitasi' });
        for (const [v, l] of [['citations', 'Sitasi langsung'], ['coupling', 'Referensi bersama'], ['cocitation', 'Co-citation']])
            option(select, v, l);
        net.actions.append(select);
        const draw = () => { net.body.replaceChildren(); net.node.querySelector('.chart-data')?.remove(); net.actions.querySelector('.chart-export')?.remove(); network(net, data.networks[select.value], r => openWork(r.id)); };
        select.onchange = draw;
        draw();
        minis(content, [['Median sitasi', decimal(k.median_citations), 'Tidak terlalu dipengaruhi pencilan'], ['h-index lingkup', num(k.h_index), 'Hanya himpunan karya aktif'], ['Rerata sitasi', decimal(data.total ? k.citations / data.total : null), 'Sitasi kumulatif dibagi karya'], ['Cakupan FWCI', pct(k.fwci_coverage), 'Nilai kosong dikeluarkan dari rerata']]);
        const concentration = k.citation_concentration_top10;
        minis(content, [['Konsentrasi sitasi 10% karya teratas', pct(concentration.value), concentration.value === null ? (concentration.works_n ? 'Seluruh karya belum disitir' : 'Tidak ada karya') : `${num(concentration.top_works_n)} dari ${num(concentration.works_n)} karya menyumbang ${num(concentration.top_citations)} dari ${num(concentration.total_citations)} sitasi`]]);
        intro(content, 'Konsentrasi sitasi menunjukkan seberapa besar porsi sitasi yang diterima 10% karya teratas dalam himpunan aktif. Nilai tinggi berarti sitasi lebih terkonsentrasi, bukan otomatis menandakan mutu yang lebih tinggi atau lebih rendah.');
    }
    else if (currentModule === 'collaboration') {
        scatter(panel(grid, 'Negara mitra penelitian', 'Negara di luar Indonesia; satu karya dapat masuk beberapa negara.'), data.top.countries.filter(r => r.id !== 'ID'), { bubble: true, onClick: r => drill({ country: r.id }) });
        groupBar(grid, 'Institusi yang terhubung', 'partners', 'partner', 'Afiliasi ganda dapat membentuk hubungan publikasi.');
        collaborationMap(grid);
        network(panel(grid, 'Jaringan kolaborasi institusi', 'Garis menunjukkan karya bersama; bukan bukti MoU.', true), data.networks.partners, r => r.id !== 'I55892964' && drill({ partner: r.id }));
        smallMultiples(panel(grid, 'Mitra dan tahun publikasi', 'Grafik garis untuk 10 institusi mitra teratas. Tahun dengan nilai nol pada seluruh mitra yang ditampilkan disembunyikan; tahun pada sumbu dapat tidak berurutan. Ini penyaringan tampilan, bukan penghapusan data sumber. Skala vertikal seragam; satu karya dapat melibatkan beberapa mitra.', true), data.top.partners, years(), (r, y) => drill({ partner: r.id, from: y, to: y }), { omitEmpty: true });
        line(panel(grid, 'Porsi kolaborasi internasional', 'Persentase karya dengan lebih dari satu negara teridentifikasi.'), data.oa_years.map(y => ({ year: y.year, count: y.total ? y.international / y.total * 100 : null })), { percent: true });
        bar(panel(grid, 'Sektor mitra', 'Satu karya dapat mencakup lebih dari satu sektor.'), data.top.sectors, { limit: 10 });
        entityTable(content, 'partners');
    }
    else if (currentModule === 'topics') {
        treemap(panel(grid, 'Komposisi bidang utama', 'Ukuran bidang proporsional terhadap jumlah karya.', true), data.top.fields, r => drill({ field: r.id }));
        heatmap(panel(grid, 'Perkembangan topik penelitian', 'Sepuluh topik teratas; satu karya dapat masuk beberapa topik.'), data.top.topics, years(), (r, y) => drill({ topic: r.id, from: y, to: y }));
        const impact = panel(grid, 'Volume dan dampak bidang', 'Ukuran gelembung mengikuti volume; sumbu vertikal memakai rerata FWCI karya bermetrik pada masing-masing bidang.');
        scatter(impact, data.top.fields.filter(r => r.fwci_n).map(r => ({ ...r, impact: r.fwci_sum / r.fwci_n })), { y: 'impact', yTitle: 'Rerata FWCI', bubble: true, onClick: r => drill({ field: r.id }) });
        fwciHelp(impact.node);
        groupBar(grid, 'Topik dominan', 'topics', 'topic','Kategori dapat tumpang tindih; bukan jumlah karya unik jika dijumlahkan.');
        const latest = Math.min(Number(filter.to) || data.current_year - 1, data.current_year - 1), growing = data.top.topics.map(r => ({ ...r, growth: r.years[latest - 1] ? ((r.years[latest] || 0) - r.years[latest - 1]) / r.years[latest - 1] * 100 : null })).filter(r => r.growth !== null && r.growth > 0).sort((a, b) => b.growth - a.growth);
        bar(panel(grid, 'Topik yang bertumbuh', `Pertumbuhan persen ${latest} terhadap ${latest - 1}, di antara 50 topik utama; hanya pembanding >0.`), growing, { value: 'growth', unit: '%', onClick: r => drill({ topic: r.id }) });
        minis(content, [['Porsi tiga bidang terbesar', pct(k.top3_fields_share), 'Termasuk kategori tidak diketahui jika ada'], ['Konsentrasi bidang (HHI)', decimal(k.field_concentration), 'Rentang 0–1; semakin tinggi semakin terkonsentrasi']]);
    }
    else if (currentModule === 'sdgs') {
        intro(content, 'Label SDGs dihasilkan model klasifikasi teks. Satu karya dapat masuk beberapa tujuan. Jumlah kategori tidak boleh dijumlahkan sebagai jumlah karya unik atau dianggap bukti dampak sosial terukur.');
        const all = Array.from({ length: 17 }, (_, i) => data.top.sdgs.find(r => r.id === String(i + 1)) || { id: String(i + 1), name: `SDG ${i + 1} · ${SDGS[i]}`, count: 0, years: {} });
        const p = panel(grid, 'Portofolio 17 tujuan pembangunan', 'Urutan resmi tujuan 1–17. Klik tujuan untuk menelusuri publikasinya.', true);
        sdgBars(p, all, { limit: 17, onClick: r => drill({ sdg: r.id }) });
        sdgNotice(p.node);
        smallMultiples(panel(grid, 'SDGs lintas tahun', 'Grafik garis untuk 10 tujuan dengan volume terbesar. Tahun dengan nilai nol pada seluruh tujuan yang ditampilkan disembunyikan; tahun pada sumbu dapat tidak berurutan. Data sumber tetap utuh. Skala vertikal seragam; satu karya dapat masuk beberapa tujuan.', true), data.top.sdgs, years(), (r, y) => drill({ sdg: r.id, from: y, to: y }), { omitEmpty: true, colorOf: r => sdgColor(r.id) });
        const fieldIds = data.top.fields.slice(0, 8).map(r => r.id);
        scatter(panel(grid, 'Keterhubungan SDGs dan bidang', 'Sumbu X nomor SDG; sumbu Y urutan bidang utama di bawah diagram.'), data.sdg_fields.filter(r => fieldIds.includes(r.field)).map(r => ({ ...r, name: `SDG ${r.sdg} · ${r.name}`, x: Number(r.sdg), y: fieldIds.indexOf(r.field) + 1 })), { x: 'x', y: 'y', xTitle: 'Nomor SDG', yTitle: 'Urutan bidang utama', bubble: true, colorOf: r => sdgColor(r.sdg), onClick: r => drill({ sdg: r.sdg, field: r.field }) });
        grid.lastElementChild.append(el('p', { class: 'panel-note' }, data.top.fields.slice(0, 8).map((r, i) => `${i + 1}. ${r.name}`).join(' · ')));
        groupBar(grid, 'Desain studi teridentifikasi', 'designs', 'design', 'Klasifikasi otomatis; kategori dapat tumpang tindih.');
    }
    else if (currentModule === 'oa') {
        donut(panel(grid, 'Jalur keterbukaan akses', 'Status OA pada saat snapshot.'), data.top.oa, r => drill({ oa: r.id === 'unknown' ? '' : r.id }));
        stacked(panel(grid, 'Perubahan komposisi OA', 'Proporsi setiap kategori per tahun; denominator seluruh karya tahun tersebut.'), data.oa_years.map(y => ({ ...y, values: y.oa })), data.top.oa, { percentage: true, onClick: (y, s) => drill({ from: y.year, to: y.year, oa: s.id }) });
        const statuses = data.top.oa.map(r => r.id), rows = data.top.fields.slice(0, 8).map(r => ({ ...r, years: Object.fromEntries(statuses.map(s => [s, data.oa_fields.find(x => x.field === r.id && x.oa === s)?.count || 0])) }));
        heatmap(panel(grid, 'Bidang dan jalur akses', 'Jumlah karya; kategori sesuai status OpenAlex.', true), rows, statuses, (r, s) => drill({ field: r.id, oa: s }));
        minis(content, [['Salinan repositori apa pun', num(data.coverage.any_repo), 'Sedikitnya satu repositori memiliki salinan'], ['Lisensi diketahui', num(data.coverage.license), 'Sedikitnya satu salinan berlisensi'], ['PDF tersedia', num(data.coverage.pdf), 'Metadata layanan konten'], ['Karya terbuka', pct(k.oa), 'Tidak otomatis memberi hak penggunaan ulang']]);
    }
    else if (currentModule === 'funding') {
        intro(content, 'Gunakan pilihan Cakupan untuk membedakan seluruh karya yang didanai Unand dari pendana pada karya berafiliasi Unand. Metadata pendanaan yang kosong tidak berarti penelitian tanpa dana.');
        groupBar(grid, 'Pendana yang tercatat', 'funders', 'funder');
        smallMultiples(panel(grid, 'Pendanaan menurut tahun', 'Grafik garis untuk 10 pendana dengan publikasi terbanyak dalam cakupan aktif. Tahun dengan nilai nol pada seluruh pendana yang ditampilkan disembunyikan; tahun pada sumbu dapat tidak berurutan. Data sumber tetap utuh. Skala vertikal seragam; satu karya dapat memiliki beberapa pendana.', true), data.top.funders, years(), (r, y) => drill({ funder: r.id, from: y, to: y }), { omitEmpty: true });
        network(panel(grid, 'Pendana dan topik penelitian', 'Hubungan berdasarkan keberadaan pendana dan topik pada karya yang sama.', true), data.networks.funding, r => drill(r.id.startsWith('F') ? { funder: r.id } : { topic: r.id }));
        minis(content, [['Karya dengan pendana', num(data.total - data.quality.funder), 'Kelengkapan metadata pendanaan'], ['Hibah teridentifikasi', num(data.top.awards.length), 'Maksimum 50 pada ringkasan'], ['APC daftar diketahui', num(k.apc_n), 'Harga daftar, bukan belanja institusi'], ['Pembayaran OpenAPC', num(k.paid_verified), 'Artikel dengan provenance OpenAPC']]);
        intro(content, `Rerata APC daftar yang diketahui: ${k.apc_mean === null ? 'Tidak tersedia' : 'US$ ' + decimal(k.apc_mean)}. ${num(k.paid_fallback)} rekaman estimasi pembayaran memakai provenance selain OpenAPC. Tidak dijumlahkan sebagai realisasi belanja Unand.`);
        entityTable(content, 'funders');
    }
    else if (journal && !filter.metricKind) {
        // Two per row: citations per year | publications per year, types | access, countries | affiliation origin.
        // Sitasi per tahun is fixed for the journal; the other charts use the journal-only summary and narrow this page.
        renderJournalCitations(grid, journalDataset, journal, filter, year => setHash('journals', { ...filter, metricYear: year }));
        line(panel(grid, 'Perjalanan publikasi jurnal', 'Jumlah karya jurnal menurut tahun publikasi. Klik tahun untuk mempersempit halaman ini.'), data.top.years, { onClick: drillYear });
        stacked(panel(grid, 'Jenis karya menurut tahun', 'Karya unik jurnal ini; jenis minor dapat berada di luar enam seri teratas.'), groupedYears('types'), data.top.types.slice(0, 6), { onClick: (y, s) => drill({ from: y.year, to: y.year, type: s.id }) });
        stacked(panel(grid, 'Komposisi akses per tahun', 'Proporsi status OA karya jurnal ini per tahun.'), data.oa_years.map(y => ({ ...y, values: y.oa })), data.top.oa, { percentage: true, onClick: (y, s) => drill({ from: y.year, to: y.year, oa: s.id }) });
        // SDG card beside author affiliation (as in the OJS widget).
        sdgCard(grid, 'SDG karya jurnal');
        const own = data.top.journals.find(r => r.id === journal.id) || { count: 0, local: 0 };
        donut(panel(grid, 'Asal afiliasi penulis', 'Karya jurnal ini dengan sedikitnya satu authorship Unand dibanding tanpa afiliasi Unand.'),
            data.total ? [{ id: 'yes', name: 'Ada afiliasi Unand', count: own.local }, { id: 'no', name: 'Tanpa afiliasi Unand', count: own.count - own.local }] : [], r => drill({ local: r.id }));
        // Contributor countries as a full-width bubble map at the bottom, Indonesia included.
        collaborationMap(grid, { title: 'Negara afiliasi kontributor', includeHome: true, unit: 'karya',
            note: 'Seluruh negara afiliasi penulis pada karya jurnal ini, termasuk Indonesia. Luas bubble sebanding dengan jumlah karya; satu karya dapat masuk beberapa negara. Hover, fokus, atau sentuh bubble untuk melihat jumlahnya.' });
    }
    else if (currentModule === 'journals' && !journal) {
        groupBar(grid, 'Sumber menurut keluaran', 'sources', 'source', 'Daftar sumber terpetakan; bukan daftar resmi seluruh jurnal aktif.');
        scatter(panel(grid, 'Volume dan sitasi sumber'), data.top.sources.map(r => ({ ...r, name: sjrName(r.id, r.name) })), { bubble: true, onClick: r => drill({ source: r.id }) });
        groupBar(grid, 'Negara afiliasi kontributor', 'countries', 'country', 'Karya terbitan Unand dapat ditulis peneliti di luar Unand.');
        stacked(panel(grid, 'Komposisi akses per tahun'), data.oa_years.map(y => ({ ...y, values: y.oa })), data.top.oa, { percentage: true, onClick: (y, s) => drill({ from: y.year, to: y.year, oa: s.id }) });
        const origins = panel(grid, 'Asal afiliasi karya per sumber', '10 jurnal dengan karya terbanyak dalam filter aktif. Setiap batang = 100% karya jurnal tersebut: ada sedikitnya satu authorship Unand atau tanpa afiliasi Unand. Nama lengkap dan angka tersedia pada tooltip dan rincian diagram.', true);
        origins.node.classList.add('source-origins');
        origins.body.style.height = '510px';
        stacked(origins, data.top.journals.map(r => ({ year: sjrName(r.id, r.name), total: r.count, source: r.id, values: { local: r.local, external: r.count - r.local } })), [{ id: 'local', name: 'Ada afiliasi Unand' }, { id: 'external', name: 'Tanpa afiliasi Unand' }], { percentage: true, horizontal: true, onClick: (y, s) => drill({ source: y.source, local: s.id === 'local' ? 'yes' : 'no' }) });
        journalTable(content);
    }
    else if (currentModule === 'repositories') {
        const c = data.coverage, coverage = [['Abstrak', c.abstract], ['PDF layanan konten', c.pdf], ['TEI XML', c.xml], ['Salinan repositori Unand', c.repo], ['Lisensi diketahui', c.license]].map(([name, count]) => ({ name: `${name} · ${num(count)} karya`, count: data.total ? count / data.total * 100 : 0 }));
        bar(panel(grid, 'Cakupan metadata dan dokumen', 'Persentase terhadap karya unik yang sesuai filter.'), data.total ? coverage : [], { limit: 5, unit: '%' });
        dots(panel(grid, 'Kelengkapan metadata', 'Persentase karya lengkap; klik untuk meninjau karya yang belum lengkap.'), data.total ? [['DOI', data.total - data.quality.doi], ['Abstrak', c.abstract], ['Sumber', data.total - data.quality.source], ['Bidang utama', data.total - data.quality.field], ['Pendana tercatat', data.total - data.quality.funder]].map(([name, n], i) => ({ id: ['doi', 'abstract', 'source', 'field', 'funder'][i], name, count: n / data.total * 100 })) : [], r => drill({ audit: r.id }));
        groupBar(grid, 'Lisensi yang dikenali', 'licenses', 'license', 'Satu karya dapat memiliki beberapa lisensi pada lokasi berbeda.');
        bar(panel(grid, 'Versi salinan yang tersedia', 'Satu karya dapat memiliki lebih dari satu versi.'), data.top.versions, { onClick: r => drill({ version: r.id }) });
        const rows = data.top.versions.map(r => ({ ...r, name: r.name.replace('Version', '') }));
        smallMultiples(panel(grid, 'Versi salinan menurut tahun publikasi', 'Grafik garis jumlah karya per versi salinan. Satu karya dapat memiliki lebih dari satu versi. Tahun dengan nilai nol pada seluruh versi yang ditampilkan disembunyikan; tahun pada sumbu dapat tidak berurutan. Skala vertikal seragam. Klik titik untuk menelusuri karya.', true), rows, years(), (r, y) => drill({ version: r.id, from: y, to: y }), { omitEmpty: true });
        const locationTypes = [...new Set(data.version_locations.map(r => r.type))], versionRows = data.top.versions.map(r => ({ ...r, years: Object.fromEntries(locationTypes.map(t => [t, data.version_locations.find(v => v.version === r.id && v.type === t)?.count || 0])) }));
        heatmap(panel(grid, 'Versi dan jenis lokasi', 'Satu karya dapat memiliki beberapa pasangan versi/lokasi.', true), versionRows, locationTypes, (r, type) => drill({ version: r.id, locationType: type }));
    }
    else if (currentModule === 'audit') {
        const labels = { doi: 'Tanpa DOI', abstract: 'Tanpa abstrak', source: 'Sumber kosong', field: 'Bidang kosong', funder: 'Pendana tidak tercatat', affiliation: 'Afiliasi belum lengkap', author_id:'Penulis tanpa ID profil', date: 'Tahun perlu diperiksa', retracted: 'Flag retraksi' };
        bar(panel(grid, 'Cakupan dan penanda pemeriksaan', 'Kekosongan metadata tidak selalu merupakan kesalahan.'), Object.entries(data.quality).map(([id, count]) => ({ id, name: labels[id], count })), { limit: 9, onClick: r => drill({ audit: r.id }) });
        heatmap(panel(grid, 'Penanda pemeriksaan menurut tahun', 'Jumlah karya dengan penanda; satu karya dapat memiliki beberapa penanda.'), Object.entries(data.quality).map(([id, count]) => ({ id, name: labels[id], count, years: data.quality_years[id] })), years(), (r, y) => drill({ audit: r.id, from: y, to: y }));
        methodPanel(grid);
    }
    if (!data.total)
        intro(content, 'Tidak ada karya pada kombinasi filter ini. Ubah periode atau hapus filter tambahan untuk memperluas penelusuran.');
    if (currentModule === 'publications' || journal || author) pubTable(content);
}
// Kartu SDG bersama halaman jurnal dan penulis: 8 tujuan teratas pada grafik, sisanya disebut di catatan.
function sdgCard(grid, title) {
    const goals = data.top.sdgs.filter(r => r.count > 0), others = goals.slice(8);
    const p = panel(grid, title, `Karya unik per tujuan; satu karya dapat masuk beberapa tujuan. Klasifikasi otomatis OpenAlex, bukan ukuran dampak.${others.length ? ` Tujuan lain: ${others.map(r => `SDG ${r.id} (${num(r.count)})`).join(', ')}.` : ''} Klik tujuan untuk mempersempit halaman ini.`);
    sdgBars(p, goals, { limit: 8, onClick: r => drill({ sdg: r.id }) });
    sdgNotice(p.node);
}
const sdgColor = id => SDG_COLORS[Number(id) - 1] || PALETTE[0];
// Wajib menurut pedoman PBB untuk penggunaan ikon SDG oleh pihak non-PBB (tujuan informasi): tautan ke situs SDG PBB dan pernyataan ini.
function sdgNotice(container) {
    const note = el('p', { class: 'panel-note sdg-notice' }, 'Ikon SDG: Perserikatan Bangsa-Bangsa, ');
    note.append(external('un.org/sustainabledevelopment ↗', 'https://www.un.org/sustainabledevelopment/'),
        document.createTextNode('. The content of this publication has not been approved by the United Nations and does not reflect the views of the United Nations or its officials or Member States.'));
    container.append(note);
}
function timelineTrack(p, label) {
    const controls = el('div', { class: 'timeline-controls' });
    const earlier = el('button', { class: 'text-button', type: 'button', 'aria-label': `Geser ${label} ke tahun lebih awal` }, '← Tahun sebelumnya');
    const later = el('button', { class: 'text-button', type: 'button', 'aria-label': `Geser ${label} ke tahun lebih baru` }, 'Tahun berikutnya →');
    controls.append(el('span', { class: 'timeline-hint' }, 'Klik tahun untuk membuka karya pembentuk angka.'), earlier, later);
    const track = el('div', { class: 'growth-timeline', tabindex: '0', role: 'region', 'aria-label': `${label}; geser untuk menelusuri seluruh tahun` });
    earlier.onclick = () => track.scrollBy({ left: -track.clientWidth * .8, behavior: 'auto' });
    later.onclick = () => track.scrollBy({ left: track.clientWidth * .8, behavior: 'auto' });
    p.node.append(controls, track);
    requestAnimationFrame(() => { if (track.isConnected) track.scrollLeft = track.scrollWidth; });
    return track;
}
function growthTimeline(grid) {
    const rows = data.publication_growth, normalization = data.growth_normalization;
    const signed = value => value === null ? 'Tidak tersedia' : `${value > 0 ? '+' : ''}${decimal(value)}`;
    const status = row => row.status === 'incomplete' ? 'Tahun belum lengkap' : row.status === 'small_base' ? 'Basis pembanding kecil'
        : row.status === 'zero_base' ? 'Pembanding nol' : row.status === 'no_comparison' ? 'Tanpa tahun pembanding' : signed(row.growth) + '%';
    const p = panel(grid, 'Timeline pertumbuhan publikasi tahunan',
        'Pertumbuhan terhadap tahun kalender sebelumnya, setelah pemeriksaan tanggal dan kelayakan pembanding. Garis putus-putus: pertumbuhan 0%.', true);
    p.node.classList.add('growth-panel');
    const description = row => `${row.year}: ${num(row.count)} karya layak timeline · tahun sebelumnya ${num(row.previous)} karya · pertumbuhan ${status(row)}`;
    const firstEligible = rows.findIndex(row => row.growth !== null);
    line(p, firstEligible < 0 ? [] : rows.slice(firstEligible), { value: 'growth', label: 'Pertumbuhan tahunan setelah normalisasi', unit: '%', color: '#368C88', reference: 0, referenceLabel: 'Pertumbuhan 0%',
        tooltip: description, onClick: row => drill({ from: row.year, to: row.year, dateQuality: 'valid' }) });
    p.node.append(el('p', { class: 'normalization-note' },
        `Normalisasi aktif: ${num(normalization.excluded_count)} dari ${num(normalization.input_count)} karya dikecualikan dari timeline berdasarkan tanggal; KPI dan metadata asli tetap tersedia. Persentase hanya ditampilkan bila pembanding ≥ ${normalization.policy.min_previous} karya dan tahun sudah lengkap. Ambang ini merupakan kebijakan tampilan, bukan uji statistik. Grafik dimulai dari tahun pertama yang memenuhi aturan; jumlah karya semua tahun layak tetap ada pada kartu.`));
    const track = timelineTrack(p, 'Timeline pertumbuhan publikasi');
    for (const row of rows) {
        const state = row.incomplete ? 'partial' : row.growth === null ? 'unavailable' : row.growth < 0 ? 'negative' : 'positive';
        const button = el('button', { class: `timeline-year ${state}`, type: 'button', 'data-year': row.year, 'aria-label': description(row), title: description(row) });
        button.append(el('span', { class: 'timeline-date' }, String(row.year)), el('strong', {}, num(row.count)), el('span', {}, 'publikasi layak timeline'),
            el('span', { class: 'timeline-growth' }, row.growth === null ? status(row) : `${row.growth > 0 ? '↑ ' : row.growth < 0 ? '↓ ' : '→ '}${signed(row.growth)}%`),
            el('small', {}, row.previous === null ? 'Tanpa tahun pembanding' : `Pembanding: ${num(row.previous)} karya`));
        if (row.raw_count !== row.count) button.append(el('small', {}, `Metadata mentah: ${num(row.raw_count)} karya`));
        button.onclick = () => drill({ from: row.year, to: row.year, dateQuality: 'valid' });
        track.append(button);
    }
    const details = el('details', { class: 'normalization-details' });
    details.append(el('summary', {}, 'Catatan normalisasi dan angka sebelum penyaringan'));
    const reasons = { invalid_year: 'Tahun kosong atau tidak valid', before_institution: `Tahun sebelum ${normalization.policy.first_year}`,
        future_year: 'Tahun setelah tahun snapshot', epoch_date: 'Tanggal penanda 31 Desember 1969 / 1 Januari 1970' };
    const list = el('ul');
    for (const [key, label] of Object.entries(reasons)) list.append(el('li', {}, `${label}: ${num(normalization.excluded[key])} karya.`));
    details.append(el('p', {}, 'Aturan tanggal merupakan penyaringan kandidat anomali untuk analisis ini; bukan keputusan bahwa semua rekaman tersebut salah. Tahun tidak ditebak atau dikoreksi. Lonjakan besar dengan pembanding yang memadai tetap ditampilkan tanpa pemotongan atau penghalusan.'), list,
        el('p', {}, `${normalization.policy.first_year} dipakai sebagai batas historis institusi. Publikasi lembaga pendahulu dapat memerlukan telaah tersendiri. `));
    details.lastElementChild.append(external('Sumber tahun peresmian Unand ↗', normalization.policy.year_source));
    details.append(el('p', {}, `Karya setelah penyaringan: ${num(normalization.retained_count)}. Tahun dengan pembanding 1–${normalization.policy.min_previous - 1} karya: ${num(normalization.small_base_years)}. Angka di bawah memakai metadata sebelum penyaringan, sesuai filter aktif:`));
    const raw = el('ul', { class: 'raw-growth-values' });
    for (const row of normalization.raw_rows.filter(row => row.count || row.growth !== null))
        raw.append(el('li', {}, `${row.year}: ${num(row.count)} karya · pembanding ${num(row.previous)} · pertumbuhan mentah ${row.growth === null ? 'Tidak tersedia' : signed(row.growth) + '%'}`));
    details.append(raw);
    p.node.append(details);
}
// Bubble map of countries; Kolaborasi leaves Indonesia out (partners), a journal page keeps it (contributors).
function collaborationMap(grid, { title = 'Peta negara mitra penelitian', note, includeHome = false, unit, wide = true } = {}) {
    const rows = data.country_map.filter(row => includeHome || row.id !== 'ID');
    const p = panel(grid, title, note ?? 'Seluruh negara/area di luar Indonesia pada filter aktif. Satu karya dapat masuk beberapa negara. Hover, fokus, atau sentuh bubble untuk melihat popup data. Interaksi peta tidak mengubah filter Jelajahi data.', wide);
    p.node.classList.add('world-map-panel');
    const draw = async () => {
        p.node.setAttribute('aria-busy', 'true');
        p.body.replaceChildren(el('div', { class: 'empty-state' }, 'Menyiapkan peta negara…'));
        try {
            if (!rows.length) { p.body.replaceChildren(); countryBubbleMap(p, rows, {}); return; }
            geographyPromise ||= getJSON('assets/world-map.json').catch(error => { geographyPromise = null; throw error; });
            const geography = await geographyPromise;
            if (!p.node.isConnected) return;
            p.body.replaceChildren();
            countryBubbleMap(p, rows, geography, unit ? { unit } : {});
        }
        catch {
            if (!p.node.isConnected) return;
            const retry = el('button', { type: 'button', class: 'button secondary' }, 'Muat ulang peta');
            retry.onclick = draw;
            p.body.replaceChildren(el('p', { class: 'empty-state' }, 'Data peta lokal belum dapat dimuat.'), retry);
        }
        finally { p.node.setAttribute('aria-busy', 'false'); }
    };
    draw();
}
function fwciTimeline(grid) {
    const rows = data.fwci_timeline, normalization = data.fwci_normalization;
    const p = panel(grid, 'Timeline FWCI',
        `${scopeName[filter.scope]} · rerata FWCI menurut tahun publikasi setelah pemeriksaan tanggal dan kelayakan metrik. Garis putus-putus: acuan global FWCI 1.`, true);
    p.node.classList.add('fwci-panel');
    const status = row => row.status === 'small_sample' ? 'Basis metrik kecil' : row.status === 'no_metric' ? 'Tidak tersedia' : decimal(row.fwci);
    const description = row => `${row.year}: rerata ${status(row)}${row.status === 'valid' ? ' FWCI' : ''} · ${num(row.fwci_n)} dari ${num(row.count)} karya layak tanggal · cakupan ${pct(row.coverage)}${row.year >= data.current_year ? ' · Tahun belum lengkap' : ''}${row.year + 3 >= data.current_year ? ' · Jendela sitasi belum penuh' : ''}`;
    const open = row => drill({ from: row.year, to: row.year, metric: 'fwci', fwciQuality: 'valid' });
    const firstEligible = rows.findIndex(row => row.status === 'valid');
    line(p, firstEligible < 0 ? [] : rows.slice(firstEligible), { value: 'fwci', label: 'Rerata FWCI karya layak', unit: 'FWCI', reference: 1, referenceLabel: 'FWCI 1 · acuan global tetap', color: '#587AA5', tooltip: description, onClick: open });
    p.node.append(el('p', { class: 'normalization-note' },
        `Normalisasi FWCI: ${num(normalization.excluded_count)} karya dikecualikan berdasarkan tanggal dan ${num(normalization.invalid_fwci_count)} nilai FWCI tidak valid dikeluarkan. Garis dan skor kartu hanya ditampilkan untuk tahun dengan ≥ ${normalization.policy.min_works} karya bermetrik; tahun berbasis kecil tetap tercatat dalam catatan. Nilai 0 sah dan nilai FWCI tinggi yang valid tidak dipotong. KPI umum tetap mengikuti metadata dan filter aktif.`));
    const guide = el('div', { class: 'fwci-guide' });
    guide.append(el('strong', {}, 'Mengapa acuan FWCI = 1?'), el('p', {},
        'Acuan global ini tetap. Target pilihan institusi harus ditampilkan terpisah. Timeline mengelompokkan skor snapshot menurut tahun publikasi, bukan riwayat perubahan skor antar-snapshot.'));
    fwciHelp(guide, { open: true, timeline: true });
    p.node.append(guide);
    const track = timelineTrack(p, 'Timeline FWCI');
    for (const row of rows.filter(row => row.count > 0)) {
        const button = el('button', { class: `timeline-year fwci-year${row.year >= data.current_year ? ' partial' : ''}`, type: 'button', 'data-year': row.year, 'aria-label': description(row), title: description(row) });
        button.append(el('span', { class: 'timeline-date' }, String(row.year)), el('strong', { class: row.status !== 'valid' ? 'metric-unavailable' : '' }, row.status === 'valid' ? decimal(row.fwci) : '—'), el('span', {}, row.status === 'valid' ? 'rerata FWCI' : status(row)),
            el('span', { class: 'timeline-growth' }, `Cakupan ${pct(row.coverage)}`), el('small', {}, `${num(row.fwci_n)} dari ${num(row.count)} karya`));
        if (row.year >= data.current_year) button.append(el('small', {}, 'Tahun belum lengkap'));
        if (row.year + 3 >= data.current_year) button.append(el('small', {}, 'Jendela sitasi belum penuh'));
        button.disabled = row.status !== 'valid';
        button.onclick = () => open(row);
        track.append(button);
    }
    const details = el('details', { class: 'normalization-details fwci-normalization-details' });
    details.append(el('summary', {}, 'Catatan penyaringan FWCI dan angka mentah'));
    details.append(el('p', {}, `Tanggal diperiksa dengan aturan yang sama seperti pertumbuhan publikasi: tahun kosong/tidak valid, sebelum ${normalization.date_policy.first_year}, setelah tahun snapshot, serta tanggal 1969-12-31/1970-01-01. Ini penyaringan kandidat anomali; tahun yang benar tidak ditebak. Ambang ${normalization.policy.min_works} karya adalah kebijakan tampilan, bukan uji statistik. ${num(normalization.small_sample_years)} tahun memiliki basis 1–${normalization.policy.min_works - 1} karya bermetrik.`));
    const reasons = { invalid_year: 'Tahun kosong/tidak valid', before_institution: 'Sebelum 1956', future_year: 'Setelah tahun snapshot', epoch_date: 'Tanggal penanda epoch' };
    const list = el('ul');
    for (const [key, label] of Object.entries(reasons)) list.append(el('li', {}, `${label}: ${num(normalization.excluded[key])} karya.`));
    list.append(el('li', {}, `FWCI negatif/bukan angka/tidak hingga: ${num(normalization.invalid_fwci_count)} nilai; FWCI kosong pada karya layak tanggal: ${num(normalization.missing_fwci_count)}.`));
    details.append(list);
    const raw = el('ul', { class: 'raw-growth-values raw-fwci-values' });
    for (const row of normalization.raw_rows.filter(row => row.count > 0)) raw.append(el('li', {}, `${row.year}: rerata mentah ${decimal(row.fwci)} FWCI · ${num(row.fwci_n)} dari ${num(row.count)} karya · cakupan ${pct(row.coverage)}`));
    details.append(raw);
    p.node.append(details, el('p', { class: 'panel-note' }));
    p.node.lastElementChild.append(external('Definisi dan perhitungan FWCI OpenAlex ↗', normalization.policy.source));
}
function annualFWCITable(container, rows) {
    const section = el('section', { class: 'panel table-panel annual-fwci' });
    section.append(el('h2', {}, 'Data mentah FWCI menurut tahun publikasi'), el('p', { class: 'panel-note' },
        `${scopeName[filter.scope]}. Angka sebelum penyaringan timeline. Rerata = jumlah FWCI valid / jumlah karya dengan FWCI valid pada tahun tersebut. Nilai 0 tetap dihitung; nilai kosong dikeluarkan. Ini merupakan rerata dampak karya dalam cakupan aktif, bukan metrik jurnal terbitan Unand. Tahun berjalan belum lengkap.`));
    fwciHelp(section);
    const wrap = el('div', { class: 'table-scroll' }), table = el('table', { 'aria-label': 'FWCI tahunan' }), head = el('thead'), tr = el('tr');
    for (const label of ['Tahun publikasi', 'Jumlah karya', 'Karya dengan FWCI', 'Cakupan FWCI', 'Rerata FWCI']) tr.append(el('th', { scope: 'col' }, label));
    head.append(tr);
    const body = el('tbody');
    for (const row of rows) {
        const item = el('tr'), year = el('td'), button = el('button', { class: 'work-title', type: 'button' }, `${row.year}${row.year === data.current_year ? ' (berjalan)' : ''}`);
        button.onclick = () => drill({ from: row.year, to: row.year });
        year.append(button);
        item.append(year);
        for (const value of [num(row.count), num(row.fwci_n), pct(row.coverage), decimal(row.fwci)]) item.append(el('td', { class: 'num' }, value));
        body.append(item);
    }
    table.append(head, body);
    wrap.append(table);
    section.append(wrap);
    container.append(section);
}
const NAME_GROUP_COLORS = ['#28745B', '#2F6FA8', '#B23A48', '#8A4F9E', '#8A5A00', '#1F7A7A', '#A3542B', '#5B6B1F'];
function entityTable(container, kind) {
    const settings = {
        authors: { title: 'Profil penulis Unand', key: 'author', name: 'Penulis',
            note: 'Seluruh profil penulis ber-ID OpenAlex dengan authorship berafiliasi Unand, diurutkan menurut jumlah karya. Bukan daftar dosen aktif. Satu orang dapat memiliki beberapa profil: baris dengan warna dan label yang sama memiliki nama yang sama setelah dinormalisasi, belum tentu orang yang sama.',
            columns: ['Karya Unand dalam filter', 'Sitasi karya Unand', 'Karya sepanjang karier', 'Sitasi sepanjang karier'],
            values: r => [num(r.count), num(r.citations), num(r.career_works), num(r.career_citations)] },
        partners: { title: 'Daftar institusi kolaborasi', key: 'partner', name: 'Institusi mitra',
            note: 'Seluruh institusi selain Unand yang teramati pada karya dalam filter aktif; 50 per halaman. Satu karya dapat melibatkan beberapa mitra. Klik institusi untuk melihat karya terkait.',
            columns: ['Negara (kode ISO)', 'Sektor', 'Publikasi bersama', 'Sitasi karya bersama'],
            values: r => [r.metadata?.country || 'Tidak tersedia', r.metadata?.type || 'Tidak tersedia', num(r.count), num(r.citations)] },
        funders: { title: 'Institusi pemberi dana', key: 'funder', name: 'Institusi pemberi dana',
            note: 'Seluruh pendana yang tercatat pada karya dalam cakupan aktif; 50 per halaman. Satu karya dihitung sekali per pendana dan dapat mencantumkan beberapa pendana.',
            columns: ['Jumlah publikasi', 'Sitasi karya didanai'], values: r => [num(r.count), num(r.citations)] },
        sources: { title: 'Metadata seluruh sumber dalam filter', key: 'source', name: 'Sumber',
            note: 'Seluruh sumber dengan karya dalam filter aktif, tanpa batas 50 teratas; 50 per halaman. Persentase tanpa afiliasi Unand = karya tanpa authorship Unand / seluruh karya sumber dalam filter × 100%. Metadata afiliasi yang belum terpetakan dapat memengaruhi klasifikasi ini. Harga APC bukan belanja institusi.',
            columns: ['Jenis', 'ISSN', 'Karya', 'Persentase Tanpa afiliasi Unand', 'DOAJ', 'APC daftar (US$)'],
            values: r => { const s = r.metadata || {}; return [s.type || 'Tidak tersedia', (s.issn || []).join(', ') || 'Tidak tersedia', num(r.count), pct(r.count ? (r.count - r.local) / r.count * 100 : null), typeof s.doaj === 'boolean' ? (s.doaj ? 'Ya' : 'Tidak') : 'Tidak tersedia', decimal(s.apc_usd ?? null)]; } },
    };
    const config = settings[kind], section = el('section', { class: 'panel table-panel entity-table', 'data-kind': kind, 'aria-busy': 'true' });
    section.append(el('h2', {}, config.title), el('p', { class: 'panel-note' }, config.note));
    const form = el('form', { class: 'table-toolbar', role: 'search' }), search = el('input', { class: 'search-input', type: 'search', placeholder: 'Cari nama atau ID dalam daftar', 'aria-label': `Cari ${config.name.toLowerCase()}` }), submit = el('button', { type: 'submit', class: 'button secondary' }, 'Cari');
    // Author name groups: clicking a group label lists every profile in that group; this button returns to the full list.
    const showAll = el('button', { type: 'button', class: 'button secondary', hidden: '' }, 'Tampilkan semua profil');
    form.append(search, submit, showAll);
    const status = el('p', { class: 'panel-note', role: 'status', 'aria-live': 'polite' }, 'Memuat daftar dari snapshot…');
    const wrap = el('div', { class: 'table-scroll' }), table = el('table', { 'aria-label': config.title }), head = el('thead'), tr = el('tr'), body = el('tbody');
    for (const label of ['Peringkat', config.name, ...config.columns]) tr.append(el('th', { scope: 'col' }, label));
    head.append(tr);
    table.append(head, body);
    wrap.append(table);
    const pagination = el('div', { class: 'pagination' }), count = el('span'), buttons = el('div');
    const prev = el('button', { type: 'button' }, '← Sebelumnya'), next = el('button', { type: 'button' }, 'Berikutnya →'), last = el('button', { type: 'button' }, 'Terakhir →');
    buttons.append(prev, next, last);
    pagination.append(count, buttons);
    section.append(form, status, wrap, pagination);
    container.append(section);
    let page = 0, query = '', group = null, lastPage = 0, sequence = 0;
    async function load(targetPage = 0) {
        const request = ++sequence;
        section.setAttribute('aria-busy', 'true');
        prev.disabled = next.disabled = last.disabled = true;
        status.textContent = 'Memuat daftar dari snapshot…';
        try {
            const result = await task('entities', { kind, search: query, group: group?.key || '', page: targetPage });
            if (request !== sequence || !section.isConnected) return;
            page = result.page;
            lastPage = Math.max(0, Math.ceil(result.total / result.page_size) - 1);
            body.replaceChildren();
            const groupColors = new Map();
            for (const row of result.rows) {
                const item = el('tr'), name = el('td'), button = el('button', { class: 'work-title', type: 'button' }, row.name);
                button.onclick = () => kind === 'authors' ? openAuthor(row.id) : drill({ [config.key]: row.id });
                name.append(button);
                const badge = kind === 'sources' ? sjrBadge(row.id) : null;
                if (badge) name.append(' ', badge);
                if (row.name_group_size > 1) {
                    // Colours are handed out per page in order of appearance, so groups on one page differ (up to the palette size).
                    if (!groupColors.has(row.name_group)) groupColors.set(row.name_group, NAME_GROUP_COLORS[groupColors.size % NAME_GROUP_COLORS.length]);
                    item.classList.add('name-group-row');
                    item.style.setProperty('--group-color', groupColors.get(row.name_group));
                    const label = el('button', { type: 'button', class: 'name-group-label', title: 'Tampilkan semua profil dengan nama yang sama setelah dinormalisasi' }, `${num(row.name_group_size)} profil bernama sama`);
                    label.onclick = () => { group = { key: row.name_group, name: row.name }; query = ''; search.value = ''; load(); };
                    name.append(' ', label);
                }
                item.append(el('td', { class: 'num' }, num(row.rank)), name);
                for (const value of config.values(row)) item.append(el('td', {}, value));
                body.append(item);
            }
            if (!result.rows.length) {
                const row = el('tr');
                row.append(el('td', { colspan: String(config.columns.length + 2) }, 'Tidak ada data yang sesuai dengan filter dan pencarian.'));
                body.append(row);
            }
            const first = result.total ? page * result.page_size + 1 : 0, end = Math.min((page + 1) * result.page_size, result.total);
            count.textContent = `${num(first)}–${num(end)} dari ${num(result.total)}`;
            showAll.hidden = !group;
            status.textContent = kind === 'authors'
                ? `${num(result.eligible)} profil penulis ber-ID dalam filter aktif${group ? ` · ${num(result.total)} profil bernama sama dengan ${group.name}` : query ? ' · ' + num(result.total) + ' hasil pencarian' : ''}.`
                : `${num(result.eligible)} ${kind === 'sources' ? 'sumber' : kind === 'funders' ? 'pendana' : 'institusi mitra'} dalam filter aktif${query ? ' · ' + num(result.total) + ' hasil pencarian' : ''}.`;
            prev.disabled = page === 0;
            next.disabled = last.disabled = page >= lastPage;
        }
        catch (error) {
            if (request !== sequence || !section.isConnected) return;
            body.replaceChildren();
            count.textContent = '';
            status.textContent = error.message + ' Tekan Cari untuk mencoba kembali.';
        }
        finally {
            if (request === sequence) section.setAttribute('aria-busy', 'false');
        }
    }
    form.onsubmit = event => { event.preventDefault(); query = search.value.trim(); group = null; load(); };
    showAll.onclick = () => { group = null; query = ''; search.value = ''; load(); };
    prev.onclick = () => load(page - 1);
    next.onclick = () => load(page + 1);
    last.onclick = () => load(lastPage);
    load();
}
function methodPanel(grid) {
    const p = panel(grid, 'Panduan membaca data', 'Definisi, cakupan, dan keterbatasan.', true);
    p.body.className = 'method-grid';
    const rows = [['Cakupan yang konsisten', 'Karya afiliasi, karya didanai, dan karya terbitan adalah himpunan berbeda. Korpus perluasan tidak digabung tanpa pilihan eksplisit.'],
        ['Sitasi dan waktu', 'Sitasi kumulatif berlaku pada tanggal snapshot. Tahun publikasi karya berbeda dari tahun suatu sitasi diterima.'],
        ['Metrik ternormalisasi', 'FWCI dan persentil hanya dihitung pada karya yang memiliki data valid. Cakupan dan penyebut selalu ditampilkan.'],
        ['Profil penulis', 'Afiliasi berasal dari publikasi dan dapat salah cocok. Jumlah profil bukan jumlah dosen aktif.'],
        ['SDGs dan topik', 'Klasifikasi otomatis. Satu karya dapat memiliki beberapa label dan angka kategori dapat tumpang tindih.'],
        ['Pembaruan dan kualitas', 'Snapshot diperbarui mingguan setelah validasi. Data lama dipertahankan jika proses gagal.']];
    for (const [title, text] of rows) {
        const box = el('div', { class: 'method-item' });
        box.append(el('h3', {}, title), el('p', {}, text));
        if (title === 'Metrik ternormalisasi') fwciHelp(box);
        p.body.append(box);
    }
    p.node.append(el('p', { class: 'panel-note' }, `Snapshot ${manifest.updated_at}. ${manifest.authorships_refreshed_at?'Metadata authorship diperiksa ulang '+formatDate(manifest.authorships_refreshed_at)+'. ':''}Metadata OpenAlex CC0; hak dokumen mengikuti lisensi aslinya. Jaringan dibatasi maksimal 40 simpul dan 150 hubungan. Sumber: help.openalex.org.`));
}
// Shared work detail: tabs "Detail" and "Karya penyitir" for every module that opens a work.
let detailToken = 0;
const citingCache = new Map();
function workTabs(body) {
    const list = el('div', { class: 'work-tabs', role: 'tablist', 'aria-label': 'Bagian detail publikasi' });
    const tabs = [['detail', 'Detail'], ['citing', 'Karya penyitir']].map(([key, label], i) =>
        el('button', { type: 'button', role: 'tab', id: `work-tab-${key}`, 'aria-controls': `work-panel-${key}`, 'aria-selected': String(i === 0), tabindex: i === 0 ? '0' : '-1' }, label));
    const panels = ['detail', 'citing'].map((key, i) => { const p = el('div', { role: 'tabpanel', id: `work-panel-${key}`, 'aria-labelledby': `work-tab-${key}`, tabindex: '0' }); p.hidden = i !== 0; return p; });
    const select = i => tabs.forEach((tab, j) => { tab.setAttribute('aria-selected', String(i === j)); tab.tabIndex = i === j ? 0 : -1; panels[j].hidden = i !== j; if (i === j) tab.focus(); });
    tabs.forEach((tab, i) => {
        tab.onclick = () => select(i);
        tab.onkeydown = e => { if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) { e.preventDefault(); select(e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length); } };
    });
    list.append(...tabs);
    body.append(list, ...panels);
    return { panel: panels[0], citingPanel: panels[1], citingTab: tabs[1] };
}
function sdgSection(w) {
    const box = el('section', { class: 'work-sdgs', 'aria-labelledby': 'work-sdg-title' }), policy = manifest.sdg || {};
    box.append(el('h3', { id: 'work-sdg-title' }, 'Tujuan Pembangunan Berkelanjutan (SDGs)'));
    const goals = workSdgs(w);
    if (goals === null) box.append(el('p', {}, 'Field SDG tidak tersedia pada snapshot ini.'));
    else if (!goals.length) box.append(el('p', {}, 'Tidak ada label SDG yang teridentifikasi dalam data saat ini.'));
    else {
        const list = el('ul', { class: 'sdg-list' });
        for (const g of goals) {
            const button = el('button', { type: 'button', class: 'sdg-chip', 'data-sdg': g.id, title: 'Tampilkan karya lain dengan SDG ini' });
            // Ikon resmi utuh (nomor, judul, piktogram) di samping nama, dengan garis warna tujuan.
            button.style.borderLeftColor = sdgColor(g.number);
            button.append(el('img', { src: `assets/sdg/sdg-${g.number}.png`, alt: '', width: '28', height: '28', loading: 'lazy' }), el('span', {}, `SDG ${g.number} · ${g.name}`));
            // Same drill as the SDG charts: keeps the journal page or author filter that is active.
            button.onclick = () => { $('detail-dialog').close(); drill({ sdg: g.id }); };
            const li = el('li'); li.append(button, el('span', { class: 'sdg-score' }, g.score === null ? 'skor tidak tersedia' : `skor keyakinan ${decimal(g.score)}`)); list.append(li);
        }
        box.append(list);
        sdgNotice(box);
    }
    const classifier = policy.classifier === 'openalex-2026-10' ? 'pengklasifikasi OpenAlex (sejak Oktober 2026)' : 'versi pengklasifikasi tidak tercatat';
    box.append(el('p', { class: 'panel-note' }, `Sumber: OpenAlex, field ${policy.field || 'sustainable_development_goals'} · ${classifier}${policy.threshold ? ` · ambang skor ${decimal(policy.threshold)}` : ''} · diambil ${formatDate(policy.retrieved_at || manifest.updated_at)}${policy.scores === false || !w.sdg_scores ? ' · skor tidak tersimpan pada snapshot ini' : ''}.`),
        el('p', { class: 'panel-note' }, 'Klasifikasi otomatis berdasarkan metadata teks; bukan penilaian atau verifikasi dampak nyata terhadap SDG. Skor adalah tingkat keyakinan pengklasifikasi, bukan probabilitas atau ukuran kontribusi. Satu karya dapat memiliki nol, satu, atau beberapa tujuan.'));
    return box;
}
async function citingFor(id) {
    const info = manifest.files.citing;
    if (!info?.entries?.length) return { status: 'unavailable', rows: [] };
    const path = `data/citing/${info.large?.includes(id) ? 'w/' + id : citingShard(id)}.json`, entry = info.entries.find(e => e.path === path);
    if (!entry) return { status: info.status, retrieved_at: info.retrieved_at, rows: [] };
    if (!citingCache.has(path)) citingCache.set(path, getJSON(path).catch(error => { citingCache.delete(path); throw error; }));
    const shard = await citingCache.get(path);
    return { status: shard.status, retrieved_at: shard.retrieved_at, rows: (shard.cited[id] || []).map(i => Object.fromEntries(CITING_FIELDS.map((f, j) => [f, shard.works[i][j]]))) };
}
async function loadCiting(w, panel, tab, token) {
    panel.replaceChildren(el('p', { 'aria-live': 'polite' }, 'Memuat karya penyitir…'));
    if (!w.scopes.some(s => s === 'published' || s === 'affiliated')) {
        panel.replaceChildren(el('p', {}, 'Daftar penyitir disiapkan untuk karya terbitan Jurnal Unand dan karya berafiliasi Unand.'));
        return;
    }
    let result;
    try { result = await citingFor(w.id); }
    catch { if (token === detailToken) panel.replaceChildren(el('p', { class: 'notice error' }, 'Data karya penyitir gagal dimuat. Periksa koneksi lalu buka kembali detail karya.')); return; }
    if (token !== detailToken) return;
    if (result.status === 'unavailable') { panel.replaceChildren(el('p', {}, 'Data karya penyitir belum tersedia pada snapshot ini.')); return; }
    tab.textContent = `Karya penyitir (${num(result.rows.length)})`;
    renderCiting(panel, w, result);
}
function renderCiting(panel, w, result) {
    const rows = result.rows, counts = el('div', { class: 'detail-grid' });
    for (const [label, value] of [['Sitasi kumulatif (OpenAlex)', num(w.citations)], ['Karya penyitir teridentifikasi', num(rows.length)], ['Sumber relasi', 'OpenAlex']]) { const c = el('div'); c.append(el('small', {}, label), el('span', {}, value)); counts.append(c); }
    const status = result.status === 'stale' ? 'Data penyitir dari pengambilan sebelumnya karena pembaruan terakhir gagal' : result.status === 'sample' ? 'Sampel uji, belum lengkap' : 'Lengkap untuk snapshot ini';
    panel.replaceChildren(counts, el('p', { class: 'panel-note' }, `${status} · diambil ${result.retrieved_at ? formatDate(result.retrieved_at) : 'tanggal tidak tercatat'}. Relasi dicatat hanya bila daftar referensi karya penyitir di OpenAlex memuat karya ini. Jumlah penyitir dapat berbeda dari sitasi kumulatif karena waktu pengambilan dan pencocokan referensi. Tahun terbit karya penyitir bukan tahun sitasi pada grafik Sitasi per tahun.`));
    // Distinguish "no citations", "not in the local sample" and "cited but no citing work proven by a reference list".
    if (!rows.length) {
        const message = !w.citations ? 'Karya ini belum memiliki sitasi dalam data saat ini.'
            : result.status === 'sample' ? `OpenAlex mencatat ${num(w.citations)} sitasi untuk karya ini, tetapi karya ini belum termasuk sampel uji data penyitir. Daftar lengkap tersedia setelah pengambilan penuh.`
            : `OpenAlex mencatat ${num(w.citations)} sitasi, tetapi pada pengambilan ini belum ada karya penyitir yang dapat dibuktikan melalui daftar referensinya.`;
        panel.append(el('p', {}, message));
        return;
    }
    const toolbar = el('div', { class: 'table-toolbar' }), search = el('input', { class: 'search-input', type: 'search', placeholder: 'Cari judul, penulis, atau sumber', 'aria-label': 'Cari karya penyitir' });
    const order = el('select', { 'aria-label': 'Urutkan karya penyitir' });
    for (const [v, l] of [['desc', 'Tahun terbaru'], ['asc', 'Tahun terlama']]) option(order, v, l);
    const shown = el('span', { class: 'panel-note', role: 'status', 'aria-live': 'polite' });
    toolbar.append(search, order, shown);
    const wrap = el('div', { class: 'table-scroll' }), table = el('table', { class: 'citing-table', 'aria-label': 'Karya penyitir' }), head = el('tr'), body = el('tbody');
    for (const [h, cls] of [['Tahun', 'num'], ['Karya penyitir', ''], ['Sumber', ''], ['Penulis', ''], ['Jenis', ''], ['Provenance', ''], ['Tautan', '']]) head.append(el('th', { scope: 'col', class: cls }, h));
    const thead = el('thead'); thead.append(head); table.append(thead, body); wrap.append(table);
    const more = el('button', { type: 'button', class: 'button secondary' }, 'Muat lebih banyak');
    let limit = 50;
    const text = r => [r.title, r.source, ...(r.authors || [])].join(' ').toLocaleLowerCase('id');
    const draw = () => {
        const term = search.value.trim().toLocaleLowerCase('id'), dir = order.value === 'asc' ? 1 : -1;
        const list = rows.filter(r => !term || text(r).includes(term)).sort((a, b) => ((a.year ?? 0) - (b.year ?? 0)) * dir || String(a.title).localeCompare(String(b.title)));
        body.replaceChildren();
        for (const r of list.slice(0, limit)) {
            const authors = r.authors?.length ? r.authors.join('; ') + (r.author_count > r.authors.length ? ` dan ${num(r.author_count - r.authors.length)} lainnya` : '') : 'Tidak tersedia';
            const link = safeURL(r.url) ? external('Buka ↗', r.url) : safeURL(r.doi) ? external('DOI ↗', r.doi) : el('span', {}, 'Tidak tersedia');
            const tr = el('tr', { 'data-citing-id': r.id });
            tr.append(el('td', { class: 'num' }, r.year ?? '—'), el('td', {}, r.title || 'Judul tidak tersedia'), el('td', {}, r.source || 'Tidak tersedia'),
                el('td', {}, authors), el('td', {}, r.type || 'Tidak tersedia'), el('td', {}, 'OpenAlex'));
            // el() takes text only, so the link element is appended to its cell.
            const cell = el('td'); cell.append(link); tr.append(cell);
            body.append(tr);
        }
        if (!list.length) { const tr = el('tr'); tr.append(el('td', { colspan: '7' }, 'Tidak ada karya penyitir yang cocok.')); body.append(tr); }
        shown.textContent = `Menampilkan ${num(Math.min(limit, list.length))} dari ${num(list.length)}${term ? ` hasil pencarian (total ${num(rows.length)})` : ''}`;
        more.hidden = list.length <= limit;
    };
    search.oninput = () => { limit = 50; draw(); };
    order.onchange = () => { limit = 50; draw(); };
    more.onclick = () => { limit += 50; draw(); };
    panel.append(toolbar, wrap, more);
    draw();
}
async function openWork(id) {
    // Each opening gets a token, so a slower response for a previous work is never shown.
    const token = ++detailToken, dialog = $('detail-dialog');
    $('detail-body').replaceChildren(el('p', {}, 'Memuat rincian publikasi…'));
    if (!dialog.open)
        dialog.showModal();
    try {
        const w = await task('detail', { id });
        if (token !== detailToken) return;
        if (!w)
            throw new Error('Karya tidak ditemukan dalam periode yang dimuat.');
        const body = $('detail-body');
        body.replaceChildren(el('h2', {}, w.title));
        if (w.scopes.includes('audit') && !w.scopes.includes('affiliated'))
            body.append(el('p', { class: 'notice' }, 'Kandidat audit afiliasi. Belum dikonfirmasi sebagai karya Unand.'));
        if (w.retracted)
            body.append(el('p', { class: 'notice error' }, 'Metadata memiliki flag retraksi. Periksa sumber dan konteks sebelum menggunakan karya ini.'));
        const sourceLine = el('p', {}, `${w.source_name || 'Sumber tidak diketahui'} · ${w.year || 'Tahun tidak diketahui'} · ${w.type}`), sourceBadge = sjrBadge(w.source);
        if (sourceBadge) sourceLine.append(' ', sourceBadge);
        body.append(sourceLine);
        const { panel, citingPanel, citingTab } = workTabs(body);
        loadCiting(w, citingPanel, citingTab, token);
        const details = el('div', { class: 'detail-grid' });
        for (const [label, value] of [['Sitasi kumulatif', num(w.citations)], ['FWCI', decimal(w.fwci)], ['Status akses', w.oa_status], ['Topik utama', w.topic_name || 'Tidak tersedia'], ['DOI', w.doi || 'Tidak tersedia'], ['Cakupan', w.scopes.map(s => scopeName[s] || 'Kandidat audit').join(' · ')]]) {
            const c = el('div');
            c.append(el('small', {}, label), el('span', {}, value));
            details.append(c);
        }
        panel.append(details);
        fwciHelp(panel, { work: true });
        panel.append(sdgSection(w));
        panel.append(el('h3', {}, 'Penulis dan afiliasi Unand'));
        const authors = el('ul', { class: 'detail-list' });
        for (const a of w.author_names) {
            const roles = `${a.unand ? ' · Unand' : ''}${a.position === 'first' ? ' · penulis pertama' : ''}${a.corresponding ? ' · corresponding' : ''}`;
            const li = el('li', {}, a.id && a.unand ? roles : `${a.name || a.id}${roles}`);
            // Penulis ber-ID dengan authorship Unand ditautkan ke halaman profilnya.
            if (a.id && a.unand) {
                const open = el('button', { type: 'button', class: 'author-link', 'data-author-profile': a.id, title: 'Buka profil penulis' }, a.name || a.id);
                open.onclick = () => { $('detail-dialog').close(); openAuthor(a.id); };
                li.prepend(open);
            }
            if (a.orcid) {
                li.append(document.createTextNode(' · '), external('ORCID ↗', a.orcid));
            }
            if (a.institution_names?.length)
                li.append(el('div', { class: 'work-source' }, a.institution_names.join('; ')));
            authors.append(li);
        }
        panel.append(authors);
        if (w.funding.length)
            panel.append(el('p', {}, 'Pendana tercatat: ' + w.funding.filter(Boolean).map(f => f.name).join('; ')));
        if (w.award_details.length)
            panel.append(el('p', {}, 'Hibah: ' + w.award_details.filter(Boolean).map(a => a.name).join('; ')));
        if (w.source_details) {
            const s = w.source_details, flag = v => typeof v === 'boolean' ? (v ? 'Ya' : 'Tidak') : 'Tidak tersedia';
            panel.append(el('p', {}, `Metadata sumber · ISSN: ${(s.issn || []).join(', ') || 'Tidak tersedia'} · DOAJ: ${flag(s.doaj)} · OJS: ${flag(s.ojs)} · APC daftar sumber: ${s.apc_usd === null || s.apc_usd === undefined ? 'Tidak tersedia' : 'US$ ' + decimal(s.apc_usd)}.`));
        }
        if (w.apc_list || w.apc_paid)
            panel.append(el('p', {}, `APC daftar: ${w.apc_list?.value_usd === undefined ? 'Tidak tersedia' : 'US$ ' + decimal(w.apc_list.value_usd)}. Estimasi pembayaran: ${w.apc_paid?.value_usd === undefined ? 'Tidak tersedia' : 'US$ ' + decimal(w.apc_paid.value_usd)}. Provenance: ${w.apc_paid?.provenance || 'Tidak tersedia'}. Bukan realisasi belanja Unand.`));
        const links = el('div', { class: 'detail-links' });
        for (const [label, url] of [['OpenAlex ↗', 'https://openalex.org/' + w.id], ['DOI ↗', w.doi], ['Salinan terbuka ↗', w.oa_url]])
            if (safeURL(url)) {
                const a = external(label, url);
                a.classList.add('button', 'secondary');
                links.append(a);
            }
        panel.append(links);
        panel.append(el('h3', {}, 'Lokasi dan versi salinan'));
        const list = el('ul', { class: 'detail-list' });
        for (const l of w.locations) {
            const li = el('li', {}, `${l.version || 'Versi tidak diketahui'} · ${l.license || 'Lisensi tidak diketahui'} · `);
            li.append(external(l.source || 'Halaman sumber', l.url));
            if (safeURL(l.pdf)) {
                li.append(document.createTextNode(' · '), external('PDF ↗', l.pdf));
            }
            list.append(li);
        }
        panel.append(list, el('p', {}, `Data diambil ${formatDate(manifest.updated_at)}. PDF dan XML belum diperiksa dengan mengunduh kontennya.`));
    }
    catch (e) {
        if (token === detailToken) $('detail-body').replaceChildren(el('p', {}, e.message));
    }
}
function formatDate(value) { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value)) + ' WIB'; }
async function route() {
    const thisRender = ++renderID;
    readRoute();
    tablePage = 0;
    tableSort = 'citations';
    note('');
    const invalidYear = value => value !== '' && value !== undefined && (!Number.isInteger(Number(value)) || Number(value) < 1500 || Number(value) > 2100);
    if (invalidYear(filter.from) || invalidYear(filter.to) || (filter.from && filter.to && Number(filter.from) > Number(filter.to))) {
        destroyCharts();
        $('content').replaceChildren(el('div', { class: 'empty-state' }, 'Perbaiki rentang tahun untuk menampilkan data.'));
        $('content').setAttribute('aria-busy', 'false');
        note('Rentang tahun tidak valid. Tahun awal harus lebih kecil atau sama dengan tahun akhir.', true);
        return;
    }
    $('content').setAttribute('aria-busy', 'true');
    if (!isDefault())
        note('Mengolah snapshot untuk filter terpilih. Rincian dimuat hanya saat diperlukan.');
    try {
        if (currentModule === 'journals') {
            journalDataset = await getJournalDataset();
            if (thisRender !== renderID) return;
            if (filter.journal && !journalDataset?.journals.some(j => j.id === filter.journal))
                throw new Error('Jurnal tidak ditemukan pada snapshot ini. Kembali ke tab Jurnal Unand.');
        }
        if (filter.metricKind) {
            const year = Number(filter.metricYear), snapshotYear = snapshotYearOf(manifest);
            if (!METRIC_KINDS.includes(filter.metricKind) || !['numerator', 'denominator'].includes(filter.metricPart) ||
                !Number.isInteger(year) || year < snapshotYear - 6 || year > snapshotYear || filter.metricKind === 'fwci' && !filter.journal)
                throw new Error('Konteks metrik tidak valid. Kembali ke tab asal metrik.');
            const window = journalWindow(filter.metricKind, year);
            // A journal drill keeps only the journal and search; a citation drill keeps the active filter.
            filter = filter.journal
                ? { journal: filter.journal, scope: 'published', corpus: 'all', source: filter.journal, ...metricDrill(year, filter.metricKind, filter.metricPart, filter.journal), from: window.publication_from, to: window.publication_to, q: filter.q || '' }
                : { ...filter, from: window.publication_from, to: window.publication_to };
        }
        const result = await getSummary();
        if (thisRender !== renderID)
            return;
        // Profil hanya tersedia bagi penulis dengan authorship berafiliasi Unand di mana pun dalam snapshot.
        if (authorPage() && !filter.from && !result.author_profile?.eligible) {
            destroyCharts();
            const box = el('div', { class: 'empty-state' }), go = el('button', { type: 'button', class: 'button secondary' }, 'Tampilkan karya penulis ini di Publikasi');
            go.onclick = () => setHash('publications', { author: filter.author, scope: 'all', corpus: 'all' });
            box.append(el('p', {}, `Profil tidak tersedia: penulis ${filter.author} tidak memiliki karya berafiliasi Unand dalam snapshot ini.`), go);
            $('content').replaceChildren(box);
            $('content').setAttribute('aria-busy', 'false');
            note('');
            return;
        }
        data = result;
        render();
        note('');
    }
    catch (e) {
        if (thisRender !== renderID)
            return;
        destroyCharts();
        $('content').replaceChildren(el('div', { class: 'empty-state' }, 'Data untuk filter ini belum dapat ditampilkan. Muat ulang atau atur ulang filter.'));
        note(e.message, true);
        $('content').setAttribute('aria-busy', 'false');
    }
}
async function exportData(type) {
    if (!manifest)
        return;
    const exportFilter = { ...filter }, button = $(type === 'csv' ? 'export-csv' : 'export-json');
    button.disabled = true;
    note('Menyiapkan ekspor dari seluruh karya yang sesuai filter…');
    try {
        const rows = await task('export',{format:type});
        if (type === 'json')
            downloadText(JSON.stringify({ metadata: { snapshot: manifest.updated_at, filter: exportFilter, source: 'OpenAlex', ror: manifest.institution.ror }, results: rows }, null, 2), 'unand-publikasi.json', 'application/json');
        else {
            const keys = Object.keys(rows[0] || { id: '', title: '', retrieved_at: '' });
            downloadText('\uFEFF' + [keys, ...rows.map(r => keys.map(k => r[k]))].map(r => r.map(csvCell).join(',')).join('\r\n'), 'unand-publikasi.csv', 'text/csv;charset=utf-8');
        }
        note('Ekspor selesai. Cakupan dan tanggal snapshot disertakan dalam berkas.');
    }
    catch (e) {
        note(e.message, true);
    }
    finally {
        button.disabled = false;
    }
}
async function init() {
    document.documentElement.dataset.exportControls = EXPORT_CONTROLS ? 'visible' : 'hidden';
    document.documentElement.dataset.contentProtection = CONTENT_PROTECTION ? 'enabled' : 'disabled';
    if (CONTENT_PROTECTION) {
        document.addEventListener('contextmenu', event => {
            if (!event.target.closest('input,textarea,select,[contenteditable="true"]')) event.preventDefault();
        });
        // Menyalin dan memotong konten halaman diblokir; kolom formulir (pencarian, filter) tetap dapat disunting.
        for (const type of ['copy', 'cut']) document.addEventListener(type, event => {
            if (!event.target.closest?.('input,textarea,select,[contenteditable="true"]')) event.preventDefault();
        });
        document.addEventListener('dragstart', event => {
            if (event.target.closest('img,svg,canvas')) event.preventDefault();
        });
        document.addEventListener('keydown', event => {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && ['s', 'p', 'u'].includes(event.key.toLowerCase())) {
                event.preventDefault();
                note('Pintasan simpan, cetak, dan lihat sumber dinonaktifkan pada dashboard ini.');
            }
        });
    }
    document.querySelector('.skip-link').onclick = event => {event.preventDefault();$('main').focus();$('main').scrollIntoView();};
    MODULES.forEach(([id, label, number], i) => { if (id === 'audit' && !SHOW_AUDIT_TAB) return; const a = el('a', { href: '#' + id, class: 'nav-link', 'data-module': id }); a.append(el('span', { class: 'nav-number', 'aria-hidden': 'true' }, icons[i]), el('span', {}, label)); a.onclick = e => { e.preventDefault(); if (!manifest)
        return; document.querySelector('.sidebar').classList.remove('open'); $('menu-toggle').setAttribute('aria-expanded', 'false'); // Setiap tab dibuka bersih: filter bawaan tab itu sendiri, tanpa membawa filter sebelumnya (sama dengan Reset semua filter).
        topicGroup = ''; topicSubfield = ''; const previousHash = location.hash; setHash(id, moduleDefaults(id)); if (location.hash === previousHash) route(); }; $('navigation').append(a); });
    $('filters-form').onsubmit = e => { e.preventDefault(); if (!manifest)
        return; const next = { ...filter }; delete next.metricKind; delete next.metricPart; for (const [k, v] of new FormData(e.currentTarget))
        next[k] = v; setHash(currentModule, next); };
    $('reset').onclick = () => {
        topicGroup = '';
        topicSubfield = '';
        if (!manifest) return;
        const previousHash = location.hash;
        setHash(currentModule, journalPage() ? { journal: filter.journal } : authorPage() ? { author: filter.author } : moduleDefaults(currentModule));
        if (location.hash === previousHash) route();
    };
    $('menu-toggle').onclick = () => { const active = document.querySelector('.sidebar').classList.toggle('open'); $('menu-toggle').setAttribute('aria-expanded', String(active)); };
    $('close-detail').onclick = () => $('detail-dialog').close();
    $('detail-dialog').onclick = e => { if (e.target === $('detail-dialog')) {
        const r = e.target.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            e.target.close();
    } };
    $('print').onclick = () => window.print();
    $('export-csv').onclick = () => exportData('csv');
    $('export-json').onclick = () => exportData('json');
    try {
        manifest = await getJSON('data/manifest.json');
        if (manifest.schema_version !== 1 || !manifest.complete)
            throw new Error('Snapshot belum lengkap atau formatnya tidak didukung.');
        const age = (Date.now() - Date.parse(manifest.updated_at)) / 86400000;
        $('freshness').textContent = age > 10 ? 'Perlu pembaruan' : 'Diperbarui mingguan';
        $('freshness').classList.toggle('stale', age > 10);
        $('freshness').title = formatDate(manifest.updated_at);
        $('snapshot-caption').textContent = `Snapshot ${formatDate(manifest.updated_at)} · Pembaruan Senin 07.23 WIB`;
        [history] = await Promise.all([getJSON(manifest.files.history.path),
            manifest.files.sjr ? getJSON(manifest.files.sjr.path).then(setSJR, () => setSJR(null)) : null]);
        window.addEventListener('hashchange', route);
        await route();
    }
    catch (e) {
        note(e.message + ' Jalankan pengambilan data dan build terlebih dahulu.', true);
        $('content').replaceChildren(el('div', { class: 'empty-state' }, 'Snapshot belum tersedia. Tidak ada data contoh yang disajikan sebagai data nyata.'));
        $('content').setAttribute('aria-busy', 'false');
    }
}
init();
