import { el, panel, line, bar, PALETTE } from './charts.js';
import { journalRecap } from './metrics.js';

const count = n => new Intl.NumberFormat('id-ID').format(n);
const ratio = n => n === null || n === undefined ? 'Tidak tersedia' : new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const pct = n => n === null || n === undefined ? 'Tidak tersedia' : ratio(n) + '%';
export const METRIC_TITLES = { four_year: 'Rasio sitasi 4 tahun', two_year: 'Rasio sitasi 2 tahun', fwci: 'FWCI' };
const period = (from, to) => from === to ? String(from) : `${from}–${to}`;
const provenance = 'Formula dihitung menggunakan metadata dan hubungan sitasi OpenAlex pada tanggal snapshot. Hasil merupakan indikator dashboard, bukan nilai resmi penyedia indeks lain. Cakupan indeks, klasifikasi dokumen, dan penetapan tahun publikasi dapat memengaruhi hasil.';
const updated = value => new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
function link(label, href) { return el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label); }

export function metricYear(years, fallback, filter) {
    return years.includes(Number(filter.metricYear)) ? Number(filter.metricYear) : fallback;
}

function formulaHelp(container, kind, populationText) {
    const details = el('details', { class: 'journal-formula' });
    details.append(el('summary', {}, 'Formula dan sumber data'));
    if (kind === 'four_year') {
        details.append(el('p', { class: 'journal-equation' }, 'R₄(Y) = sitasi pada Y−3…Y kepada dokumen layak terbitan Y−3…Y ÷ jumlah dokumen layak terbitan Y−3…Y.'),
            el('p', {}, 'Dokumen layak: artikel, review, makalah konferensi lengkap, bab buku, dan artikel data. Pembilang dan penyebut memakai jenis dokumen sasaran yang sama. Dataset bukan artikel data; abstrak konferensi bukan makalah lengkap.'),
            el('p', {}, 'Pemetaan metadata: article, review, conference-paper, proceedings-article (label lama), book-chapter, dan data-paper. Klasifikasi metadata tidak menjamin kesamaan klasifikasi atau seleksi dengan indeks lain.'),
            el('p', {}, 'Struktur formula mengacu pada metodologi CiteScore empat tahun. Nilainya dihitung sendiri dari indeks yang berbeda.'),
            link('Metodologi formulasi ↗', 'https://service.elsevier.com/app/answers/detail/a_id/14880/supporthub/scopus/'));
    } else {
        details.append(el('p', { class: 'journal-equation' }, 'R₂(Y) = sitasi pada Y kepada seluruh konten terbitan Y−2 dan Y−1 ÷ jumlah artikel dan review terbitan Y−2 dan Y−1.'),
            el('p', {}, 'Sitasi kepada editorial, surat, dan konten lain dapat masuk pembilang. Penyebut hanya metadata article dan review. Karena kedua himpunan berbeda, nilai ini merupakan rasio terhadap artikel dan review, bukan rerata sitasi setiap artikel.'),
            el('p', {}, 'Struktur formula mengacu pada JIF standar dua tahun. Nilainya dihitung sendiri; 2yr_mean_citedness tidak digunakan.'),
            link('Metodologi formulasi ↗', 'https://clarivate.libguides.com/jcr/basics'));
    }
    details.append(el('p', {}, provenance), el('p', {}, `${populationText} Setiap karya dihitung sekali per ID. Sitasi mandiri tercakup, flag retraksi dipertahankan. Nilai tinggi yang sah tidak dipotong. Jenis yang tidak dikenali tidak dipaksakan menjadi artikel/review.`),
        el('p', {}, 'Tahun tanpa entri sitasi diperlakukan nol hanya di dalam riwayat yang didukung. Timeline dibatasi agar seluruh jendela berada dalam cakupan sepuluh tahun. Nilai historis dapat berubah setelah pembaruan metadata.'),
        link('Dokumentasi sitasi tahunan ↗', 'https://help.openalex.org/data/works/attributes/'));
    container.append(details);
}
function drillButton(label, kind, part, year, onDrill) {
    const button = el('button', { class: 'data-drill', type: 'button', 'data-metric-part': part }, label);
    button.onclick = () => onDrill(kind, part, year);
    return button;
}
function drillActions(row, kind, onDrill) {
    const actions = el('div', { class: 'journal-drill-actions' });
    actions.append(drillButton('Telusuri dokumen sasaran pembilang', kind, 'numerator', row.year, onDrill),
        drillButton('Telusuri dokumen penyebut', kind, 'denominator', row.year, onDrill));
    return actions;
}
function breakdown(container, row, kind, onDrill) {
    const details = el('details', { class: 'journal-breakdown' });
    details.append(el('summary', {}, 'Rincian perhitungan'),
        el('p', {}, `${count(row.target_documents)} dokumen sasaran pembilang, termasuk yang memiliki nol sitasi. Jumlah dokumen sasaran berbeda dari jumlah sitasinya.`),
        el('p', {}, `${count(row.retracted)} dokumen berflag retraksi dan ${count(row.unknown_types)} dokumen dengan jenis tidak dikenali dalam jendela publikasi.${row.breakdown ? ' Rincian mencakup jenis yang dikecualikan agar pemilihan penyebut dapat diperiksa.' : ''}`),
        drillActions(row, kind, onDrill));
    if (row.breakdown) {
        const wrap = el('div', { class: 'table-scroll' }), table = el('table', { 'aria-label': `Rincian ${METRIC_TITLES[kind]}` }), head = el('thead'), tr = el('tr'), body = el('tbody');
        for (const label of ['Tahun terbit', 'Jenis metadata', 'Dokumen terpetakan', 'Dokumen sasaran', 'Sitasi dalam jendela', 'Dokumen penyebut']) tr.append(el('th', { scope: 'col' }, label));
        head.append(tr);
        for (const group of row.breakdown) {
            const tr = el('tr');
            for (const value of [group.year, group.type, group.works, group.targets, group.citations, group.denominator]) tr.append(el('td', {}, String(value)));
            body.append(tr);
        }
        if (!row.breakdown.length) {
            const tr = el('tr'); tr.append(el('td', { colspan: 6 }, 'Tidak ada dokumen pada jendela publikasi ini.')); body.append(tr);
        }
        table.append(head, body); wrap.append(table); details.append(wrap);
    }
    container.append(details);
}
function yearPicker(years, snapshotYear, selected, onYear) {
    const toolbar = el('div', { class: 'journal-toolbar' }), label = el('label', {}, 'Tahun metrik');
    const year = el('select', { id: 'metric-year', 'aria-label': 'Tahun metrik sitasi' });
    for (const y of [...years].reverse()) year.append(el('option', { value: y }, `${y}${y === snapshotYear ? ' · Sementara — tahun berjalan' : ''}`));
    year.value = selected;
    year.onchange = () => onYear(Number(year.value));
    label.append(year); toolbar.append(label);
    return toolbar;
}
function section(container, title) {
    const node = el('section', { class: 'journal-metrics', 'aria-labelledby': 'impact-metrics-title' });
    node.append(el('h2', { id: 'impact-metrics-title' }, title));
    container.append(node);
    return node;
}

function fwciCard(container, charts, rows, year, ctx) {
    const row = rows.find(r => r.year === year), title = ctx.fwciTitle;
    const card = el('article', { class: 'panel journal-fwci', 'data-impact-fwci': '' });
    card.append(el('h3', {}, title), el('p', { class: 'panel-note' }, `Rerata FWCI karya yang terbit pada ${year} · ${ctx.populationLabel}`));
    // Institution rows hide small bases like the FWCI timeline; journal rows show them with a note.
    const smallHidden = row?.status === 'small_sample';
    card.append(el('div', { class: 'journal-ratio-value journal-fwci-value' }, smallHidden ? 'Basis metrik kecil' : ratio(row?.value ?? null)),
        el('p', { class: 'journal-fwci-coverage' }, row ? `${count(row.denominator)} dari ${count(row.total_documents)} karya memiliki FWCI valid · cakupan ${pct(row.coverage)}` : 'Tidak ada karya pada tahun publikasi ini.'));
    if (row?.numerator !== undefined) card.append(el('p', {}, row.denominator ? `Jumlah skor FWCI ${ratio(row.numerator)} ÷ ${count(row.denominator)} karya bermetrik. Nilai nol disertakan; skor kosong, negatif, atau tidak hingga dikecualikan.` : 'Tidak tersedia — tidak ada karya dengan FWCI valid pada tahun publikasi ini.'));
    if (smallHidden) card.append(el('p', { class: 'journal-small-base' }, `Kurang dari 30 karya bermetrik; rerata teramati ${ratio(row.observed)} tidak dijadikan skor, sama seperti Timeline FWCI.`));
    else if (row?.small_base) card.append(el('p', { class: 'journal-small-base' }, 'Basis dokumen kecil — kurang dari 30 karya bermetrik.'));
    if (row?.window_incomplete) card.append(el('p', { class: 'journal-small-base' }, `Jendela sitasi ${year}–${year + 3} belum penuh pada tanggal snapshot. Skor dapat berubah.`));
    const help = el('details', { class: 'fwci-help' });
    help.append(el('summary', {}, 'Arti FWCI dan cara pengukuran'),
        el('p', {}, 'FWCI (Field-Weighted Citation Impact) per karya = sitasi diterima ÷ sitasi yang diharapkan untuk karya dengan tahun, jenis, dan subbidang yang sama. Jendela mencakup tahun publikasi dan tiga tahun berikutnya. Skor per karya berasal dari OpenAlex; dashboard tidak menghitung ulang pembanding global.'),
        el('p', {}, `${title} di sini adalah rerata skor FWCI valid karya pada tahun publikasi terpilih (${ctx.populationLabel}). Cakupan = jumlah karya dengan FWCI valid ÷ seluruh karya pada tahun tersebut × 100%. Ini bukan rasio total sitasi dibagi total sitasi yang diharapkan.`),
        el('p', {}, 'Acuan 1 berarti rerata pembanding global; 2 berarti dua kali dan 0,5 separuhnya. Cakupan metadata dan jumlah karya perlu dipertimbangkan saat membaca hasil.'),
        link('Metode FWCI OpenAlex ↗', 'https://help.openalex.org/data/works/citations/'));
    card.append(help);
    if (row?.denominator) card.append(drillButton('Telusuri karya dengan FWCI valid', 'fwci', 'denominator', year, ctx.onDrill));
    container.append(card);
    const chart = panel(charts, `Timeline ${title}`, `Rerata skor FWCI karya menurut tahun publikasi · ${ctx.populationLabel}. Klik tahun untuk memperbarui metrik. Nilai kosong membentuk jeda; acuan global tetap 1.`, ctx.fwciWide !== false);
    chart.node.dataset.impactTimeline = 'fwci';
    line(chart, rows, { value: 'value', label: `Rerata ${title}`, color: PALETTE[2], unit: 'FWCI', reference: 1, referenceLabel: 'Acuan global FWCI 1', footer: ctx.footer,
        tooltip: r => `${r.year}: FWCI ${r.status === 'small_sample' ? 'basis metrik kecil' : ratio(r.value)} · ${count(r.denominator)}/${count(r.total_documents)} karya · cakupan ${pct(r.coverage)}${r.window_incomplete ? ' · jendela sitasi belum penuh' : ''}${r.small_base ? ' · basis dokumen kecil' : ''}`,
        onClick: r => ctx.onYear(r.year) });
}

/* Shared panel: four-year and two-year citation ratios plus FWCI for one population.
   series = { four_year, two_year, fwci } rows; used by the journal page and the Dampak sitasi tab. */
export function renderImpactMetrics(container, series, ctx) {
    const node = section(container, ctx.title);
    node.append(el('p', { class: 'panel-note' }, ctx.note), yearPicker(ctx.years, ctx.snapshotYear, ctx.year, ctx.onYear));
    const cards = el('div', { class: 'journal-ratio-grid' }), fwciContainer = el('div'), charts = el('div', { class: 'charts-grid journal-timelines' });
    node.append(cards, fwciContainer, charts);
    for (const [i, kind] of ['four_year', 'two_year'].entries()) {
        const row = series[kind].find(r => r.year === ctx.year), title = METRIC_TITLES[kind];
        const card = el('article', { class: 'panel journal-ratio', 'data-impact-metric': kind });
        card.append(el('h3', {}, title), el('p', { class: 'panel-note' }, kind === 'four_year' ? 'Sitasi dan publikasi dalam jendela empat tahun yang sama · pola CiteScore' : 'Sitasi satu tahun kepada publikasi dua tahun sebelumnya · pola JIF'),
            el('div', { class: 'journal-ratio-value' }, ratio(row.value)),
            el('p', { class: 'journal-status' }, row.denominator === 0 ? 'Tidak tersedia — tidak ada dokumen penyebut' : row.status === 'provisional' ? 'Sementara — tahun belum lengkap' : 'Tahun kalender lengkap · data mengikuti snapshot'));
        if (row.small_base) card.append(el('p', { class: 'journal-small-base' }, 'Basis dokumen kecil — kurang dari 30 dokumen penyebut.'));
        const counts = el('dl', { class: 'journal-counts' });
        counts.append(el('dt', {}, kind === 'four_year' ? 'Sitasi dalam jendela 4 tahun' : 'Sitasi pada tahun metrik'),
            el('dd', { 'data-metric-count': 'numerator' }, count(row.numerator)),
            el('dt', {}, kind === 'four_year' ? 'Dokumen terbit dalam jendela 4 tahun' : 'Artikel dan review pada 2 tahun sebelumnya'),
            el('dd', { 'data-metric-count': 'denominator' }, count(row.denominator)));
        card.append(counts, el('p', {}, `Periode publikasi: ${period(row.publication_from, row.publication_to)}. ${kind === 'four_year' ? 'Periode sitasi' : 'Tahun sitasi'}: ${period(row.citation_from, row.citation_to)}.`),
            el('p', {}, kind === 'four_year' ? 'Rasio sitasi per dokumen dalam jendela pengamatan; setiap dokumen tidak selalu menerima jumlah sitasi yang sama.' : 'Pembilang mencakup konten lebih luas daripada penyebut. Nilai ini bukan rerata sitasi setiap artikel.'));
        formulaHelp(card, kind, ctx.populationText); breakdown(card, row, kind, ctx.onDrill); cards.append(card);
        const chart = panel(charts, `Timeline ${title.toLowerCase()}`, kind === 'four_year'
            ? 'Jendela empat tahun bergeser dan saling tumpang tindih. Klik tahun untuk memperbarui panel. Skor kosong membentuk jeda.'
            : 'Setiap titik memakai sitasi pada tahun metrik kepada konten dua tahun sebelumnya. Klik tahun untuk memperbarui panel. Skor kosong membentuk jeda.');
        chart.node.dataset.impactTimeline = kind;
        line(chart, series[kind], { value: 'value', label: title, color: PALETTE[i === 0 ? 0 : 3], unit: 'sitasi per dokumen pembagi', footer: ctx.footer,
            tooltip: r => `${r.year}${r.status === 'provisional' ? ' (sementara)' : ''}: ${ratio(r.value)} · ${count(r.numerator)} sitasi ÷ ${count(r.denominator)} dokumen · publikasi ${period(r.publication_from, r.publication_to)} · sitasi ${period(r.citation_from, r.citation_to)}${r.small_base ? ' · basis dokumen kecil' : ''}`,
            onClick: r => ctx.onYear(r.year) });
    }
    fwciCard(fwciContainer, charts, series.fwci, ctx.year, ctx);
    return node;
}

// Journals tab: recap of every metric across all mapped Unand journals for the selected and the running year.
export function renderJournalRecap(container, dataset, filter, onYear, onOpen) {
    const node = section(container, 'Dampak sitasi jurnal Unand');
    if (!dataset) { node.append(el('p', { class: 'empty-state' }, 'Dataset metrik jurnal belum tersedia pada snapshot ini.')); return; }
    if (!dataset.journals.length) { node.append(el('p', { class: 'empty-state' }, 'Belum ada sumber bertipe jurnal yang terpetakan di bawah penerbit Unand.')); return; }
    const titles = { ...METRIC_TITLES, fwci: 'FWCI jurnal' };
    const year = metricYear(dataset.years, dataset.defaults.year, filter), recap = journalRecap(dataset, year), running = journalRecap(dataset, dataset.snapshot_year);
    const series = dataset.years.map(y => journalRecap(dataset, y));
    node.append(el('p', { class: 'panel-note' }, `Rekap ${count(dataset.journals.length)} jurnal terpetakan di bawah penerbit Unand. Rerata antarjurnal memberi bobot sama pada setiap jurnal yang memiliki nilai; gabungan = jumlah pembilang ÷ jumlah penyebut seluruh jurnal, sehingga jurnal bervolume besar lebih berpengaruh. Klik nama jurnal untuk membuka halaman khusus jurnal tersebut. Data diperbarui: ${updated(dataset.updated_at)} WIB. Filter Jelajahi data tidak mengubah rekap ini.`),
        yearPicker(dataset.years, dataset.snapshot_year, year, onYear));
    const cards = el('div', { class: 'journal-recap-grid' }), charts = el('div', { class: 'charts-grid journal-timelines' });
    node.append(cards);
    for (const [i, kind] of ['four_year', 'two_year', 'fwci'].entries()) {
        const r = recap[kind], title = titles[kind];
        const card = el('article', { class: 'panel journal-ratio journal-recap', 'data-journal-recap': kind });
        card.append(el('h3', {}, title), el('p', { class: 'panel-note' }, `Rerata antarjurnal · ${kind === 'fwci' ? 'karya terbit ' : 'tahun metrik '}${year}`),
            el('div', { class: 'journal-ratio-value' }, ratio(r.mean)),
            el('p', { class: 'journal-status' }, r.status === 'unavailable' ? 'Tidak tersedia — tidak ada jurnal bernilai' : r.status === 'provisional' ? 'Sementara — tahun atau jendela sitasi belum lengkap' : 'Tahun kalender lengkap · data mengikuti snapshot'));
        const counts = el('dl', { class: 'journal-counts' });
        counts.append(el('dt', {}, 'Median antarjurnal'), el('dd', { 'data-journal-count': 'median' }, ratio(r.median)),
            el('dt', {}, kind === 'fwci' ? 'Gabungan seluruh karya bermetrik' : 'Gabungan seluruh jurnal'), el('dd', { 'data-journal-count': 'pooled' }, ratio(r.pooled)),
            el('dt', {}, 'Jurnal bernilai'), el('dd', { 'data-journal-count': 'journals' }, `${count(r.journals_with_value)} dari ${count(recap.journals)}`));
        card.append(counts, el('p', {}, kind === 'fwci'
            ? `Gabungan = jumlah skor FWCI ${ratio(r.numerator)} ÷ ${count(r.denominator)} karya bermetrik dari ${count(r.total_documents)} karya · cakupan ${pct(r.coverage)}. Acuan global FWCI tetap 1.`
            : `Gabungan = ${count(r.numerator)} sitasi ÷ ${count(r.denominator)} dokumen penyebut dari seluruh jurnal.`));
        if (year !== dataset.snapshot_year) {
            const now = running[kind];
            card.append(el('p', { class: 'journal-running', 'data-journal-running': kind }, `Tahun berjalan ${dataset.snapshot_year} (sementara): rerata ${ratio(now.mean)} · gabungan ${ratio(now.pooled)} · ${count(now.journals_with_value)} jurnal bernilai.`));
        }
        if (kind === 'fwci') {
            const help = el('details', { class: 'fwci-help' });
            help.append(el('summary', {}, 'Arti FWCI dan cara pengukuran'),
                el('p', {}, 'FWCI per karya = sitasi diterima ÷ sitasi yang diharapkan untuk karya dengan tahun, jenis, dan subbidang yang sama, dalam jendela tahun publikasi sampai tiga tahun berikutnya. Skor per karya berasal dari OpenAlex.'),
                el('p', {}, 'FWCI jurnal = rerata skor valid karya jurnal pada tahun publikasi terpilih. Rerata antarjurnal merata-ratakan nilai tersebut; gabungan merata-ratakan seluruh skor karya bermetrik dari semua jurnal.'),
                link('Metode FWCI OpenAlex ↗', 'https://help.openalex.org/data/works/citations/'));
            card.append(help);
        } else formulaHelp(card, kind, 'Karya dipetakan ke jurnal melalui sumber utama; seluruh afiliasi dan korpus yang terkumpul disertakan.');
        cards.append(card);
        const chart = panel(charts, `Timeline ${kind === 'fwci' ? title : title.toLowerCase()} · rerata antarjurnal`, 'Klik tahun untuk memperbarui rekap. Tahun tanpa jurnal bernilai membentuk jeda.');
        chart.node.dataset.journalTimeline = kind;
        line(chart, series.map(s => ({ year: s.year, value: s[kind].mean, pooled: s[kind].pooled, n: s[kind].journals_with_value, status: s[kind].status })), {
            value: 'value', label: `${title} · rerata antarjurnal`, color: PALETTE[[0, 3, 2][i]], unit: kind === 'fwci' ? 'FWCI' : 'sitasi per dokumen pembagi',
            ...(kind === 'fwci' ? { reference: 1, referenceLabel: 'Acuan global FWCI 1' } : {}),
            footer: `Seluruh jurnal terpetakan penerbit Unand · Snapshot ${dataset.updated_at}`,
            tooltip: s => `${s.year}${s.status === 'provisional' ? ' (sementara)' : ''}: rerata ${ratio(s.value)} · gabungan ${ratio(s.pooled)} · ${count(s.n)} jurnal bernilai`,
            onClick: s => onYear(s.year) });
    }
    node.append(charts);
    const tablePanel = el('section', { class: 'panel table-panel journal-recap-table' });
    tablePanel.append(el('h2', {}, `Nilai per jurnal · ${year}`), el('p', { class: 'panel-note' }, 'Klik nama jurnal untuk membuka halaman khusus jurnal: KPI, metrik, grafik, dan artikel hanya dari jurnal tersebut. Tanda * menandai basis kurang dari 30 dokumen.'));
    const wrap = el('div', { class: 'table-scroll' }), table = el('table', { 'aria-label': `Metrik sitasi per jurnal ${year}` }), head = el('tr'), body = el('tbody');
    for (const [label, cls] of [['Jurnal', ''], [titles.four_year, 'num'], [titles.two_year, 'num'], [titles.fwci, 'num'], [`Karya terbit ${year}`, 'num']]) head.append(el('th', { scope: 'col', class: cls }, label));
    const mark = r => r ? `${ratio(r.value)}${r.small_base ? '*' : ''}` : 'Tidak tersedia';
    for (const journal of dataset.journals) {
        const pick = kind => journal.series[kind].find(r => r.year === year), fwci = pick('fwci');
        const tr = el('tr'), name = el('td'), button = el('button', { class: 'work-title', type: 'button', 'data-journal-profile': journal.id }, journal.name);
        button.onclick = () => onOpen(journal.id, year);
        name.append(button);
        tr.append(name, el('td', { class: 'num' }, mark(pick('four_year'))), el('td', { class: 'num' }, mark(pick('two_year'))), el('td', { class: 'num' }, mark(fwci)), el('td', { class: 'num' }, count(fwci?.total_documents ?? 0)));
        body.append(tr);
    }
    const thead = el('thead'); thead.append(head); table.append(thead, body); wrap.append(table); tablePanel.append(wrap); node.append(tablePanel);
}

// Journal page header and metric panel: data from journal-metrics.json for this journal only.
export function renderJournalHeader(container, dataset, journal, onBack) {
    const header = el('section', { class: 'journal-page-head' }), back = el('button', { class: 'button secondary', type: 'button' }, '← Semua jurnal Unand');
    back.onclick = onBack;
    header.append(back, el('h2', { id: 'journal-page-title' }, journal.name),
        el('p', { class: 'panel-note' }, `${journal.issn.length ? 'ISSN ' + journal.issn.join(', ') + ' · ' : ''}Halaman khusus jurnal: KPI, metrik, grafik, dan daftar artikel hanya memuat karya yang terbit pada jurnal ini (seluruh afiliasi dan korpus terkumpul). Data diperbarui: ${updated(dataset.updated_at)} WIB.`));
    container.append(header);
    return header;
}
export function renderJournalMetrics(container, dataset, journal, filter, { onYear, onDrill }) {
    const year = metricYear(dataset.years, dataset.defaults.year, filter);
    return renderImpactMetrics(container, journal.series, {
        title: 'Dampak sitasi jurnal', fwciTitle: 'FWCI jurnal', years: dataset.years, snapshotYear: dataset.snapshot_year, year, onYear, onDrill,
        populationLabel: 'karya jurnal ini',
        populationText: 'Hanya karya yang dipetakan ke jurnal ini melalui sumber utama; seluruh afiliasi dan korpus yang terkumpul disertakan.',
        note: `Metrik ${journal.name} untuk tahun terpilih. Filter pada halaman jurnal tidak mengubah panel ini. ${count(journal.excluded_publication_years)} dokumen tanpa tahun publikasi layak tidak digunakan.`,
        footer: `${journal.name} · Seluruh afiliasi dan korpus terkumpul · Snapshot ${dataset.updated_at}`,
        // Half width, so Sitasi per tahun can share its row.
        fwciWide: false });
}

// Citations per year for one journal, with three-year totals for the window ending at the selected metric year.
export function renderJournalCitations(container, dataset, journal, filter, onYear) {
    const history = journal.citations;
    if (!history) return;
    const year = metricYear(dataset.years, dataset.defaults.year, filter), window = history.three_year.find(r => r.year === year);
    const p = panel(container, 'Sitasi per tahun', `Jumlah sitasi yang diterima seluruh karya ${journal.name} pada setiap tahun sitasi (counts_by_year OpenAlex, ${history.by_year[0].year}–${history.by_year.at(-1).year}). Tahun ${dataset.snapshot_year}* belum lengkap. Klik tahun untuk memilih jendela tiga tahun yang berakhir pada tahun tersebut.`);
    p.node.dataset.journalCitations = '';
    p.node.classList.add('journal-citations');
    const selectable = new Set(dataset.years);
    bar(p, history.by_year.map(r => ({ id: String(r.year), name: `${r.year}${r.partial ? '*' : ''}`, count: r.citations, year: r.year })),
        { horizontal: false, limit: history.by_year.length, unit: 'sitasi', color: PALETTE[0], onClick: r => selectable.has(r.year) && onYear(r.year) });
    if (!window) return;
    const span = `${window.from}–${window.to}`, totals = el('dl', { class: 'journal-counts journal-citation-totals' });
    totals.append(el('dt', {}, `Total sitasi ${span}`), el('dd', { 'data-citation-total': 'all' }, count(window.citations)),
        el('dt', {}, `Total sitasi ${span} kepada karya terbitan ${span}`), el('dd', { 'data-citation-total': 'recent' }, count(window.recent_citations)));
    p.node.append(totals, el('p', { class: 'panel-note' }, `Jendela tiga tahun berakhir pada tahun metrik ${year}. Angka pertama menjumlahkan sitasi pada ${span} kepada seluruh karya jurnal, berapa pun tahun terbitnya. Angka kedua hanya menghitung sitasi kepada ${count(window.recent_documents)} karya yang terbit pada ${span}, semua jenis dokumen. Sitasi mandiri tercakup.${window.partial ? ` Tahun ${dataset.snapshot_year} belum lengkap; total dapat bertambah.` : ''}`));
}
