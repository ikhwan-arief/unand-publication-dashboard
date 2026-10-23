import { el, panel, line, PALETTE } from './charts.js';
import { journalMetricDrill } from './metrics.js';

const count = n => new Intl.NumberFormat('id-ID').format(n);
const ratio = n => n === null ? 'Tidak tersedia' : new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
export const JOURNAL_TITLES = { four_year: 'Rasio sitasi 4 tahun', two_year: 'Rasio sitasi 2 tahun', fwci: 'FWCI jurnal' };
const period = (from, to) => from === to ? String(from) : `${from}–${to}`;
const provenance = 'Formula dihitung menggunakan metadata dan hubungan sitasi OpenAlex pada tanggal snapshot. Hasil merupakan indikator dashboard, bukan nilai resmi penyedia indeks lain. Cakupan indeks, klasifikasi dokumen, dan penetapan tahun publikasi dapat memengaruhi hasil.';

export function journalSelection(dataset, filter) {
    const source = dataset.journals.some(j => j.id === filter.journalSource) ? filter.journalSource : dataset.defaults.source;
    const year = dataset.years.includes(Number(filter.journalYear)) ? Number(filter.journalYear) : dataset.defaults.year;
    return { source, year };
}

export function searchJournals(journals, query) {
    const normalize = s => s.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('id');
    const term = normalize(query.trim());
    return [...journals].sort((a, b) => a.name.localeCompare(b.name, 'id') || a.id.localeCompare(b.id))
        .filter(j => normalize(j.name).includes(term));
}
function journalPicker(journals, selected, onSelect) {
    const field = el('div', { class: 'journal-source-field' }), label = el('label', { for: 'journal-metric-source' }, 'Jurnal');
    const combo = el('div', { class: 'journal-combobox' });
    const input = el('input', { id: 'journal-metric-source', type: 'text', role: 'combobox', 'aria-label': 'Jurnal untuk metrik sitasi',
        'aria-autocomplete': 'list', 'aria-haspopup': 'listbox', 'aria-controls': 'journal-source-options', 'aria-expanded': 'false',
        'aria-describedby': 'journal-search-help', autocomplete: 'off', spellcheck: 'false' });
    const toggle = el('button', { class: 'journal-picker-toggle', type: 'button', 'aria-label': 'Tampilkan semua jurnal', 'aria-controls': 'journal-source-options', 'aria-expanded': 'false' }, '▾');
    const list = el('div', { id: 'journal-source-options', role: 'listbox', 'aria-label': 'Daftar jurnal', class: 'journal-options', hidden: '' });
    const help = el('small', { id: 'journal-search-help', class: 'panel-note' }, 'Ketik nama jurnal untuk mencari. Pilih hasil atau gunakan tombol panah dan Enter.');
    const status = el('span', { class: 'journal-search-status', role: 'status', 'aria-live': 'polite' });
    input.value = selected.name; input.dataset.source = selected.id;
    let results = [], active = -1, chosen = selected;
    const close = () => {
        list.hidden = true; input.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant'); input.value = chosen.name; status.textContent = '';
    };
    const highlight = index => {
        active = index;
        [...list.querySelectorAll('[role="option"]')].forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
        if (index >= 0) {
            input.setAttribute('aria-activedescendant', `journal-option-${index}`);
            list.children[index].scrollIntoView({ block: 'nearest' });
        } else input.removeAttribute('aria-activedescendant');
    };
    const choose = journal => { chosen = journal; input.dataset.source = journal.id; close(); onSelect(journal.id); };
    const show = query => {
        results = searchJournals(journals, query); active = -1; list.replaceChildren();
        for (const [i, journal] of results.entries()) {
            const item = el('div', { id: `journal-option-${i}`, role: 'option', 'data-source': journal.id, 'aria-selected': 'false' }, journal.name);
            item.onmousedown = e => e.preventDefault();
            item.onclick = () => choose(journal);
            list.append(item);
        }
        if (!results.length) list.append(el('div', { class: 'journal-no-results' }, 'Tidak ada jurnal yang cocok.'));
        list.hidden = false; input.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-expanded', 'true');
        input.removeAttribute('aria-activedescendant'); status.textContent = `${results.length} jurnal ditemukan`;
    };
    input.onfocus = () => { show(''); input.select(); };
    input.oninput = () => show(input.value);
    input.onblur = close;
    input.onkeydown = event => {
        if (event.isComposing) return;
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            if (list.hidden && ['Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            if (list.hidden) show('');
            if (results.length) highlight(event.key === 'Home' ? 0 : event.key === 'End' ? results.length - 1 :
                event.key === 'ArrowDown' ? (active + 1) % results.length : (active < 0 ? results.length - 1 : (active - 1 + results.length) % results.length));
        } else if (event.key === 'Enter' && !list.hidden) {
            event.preventDefault();
            if (results.length && (active >= 0 || results.length === 1)) choose(results[active < 0 ? 0 : active]);
        } else if (event.key === 'Escape') { event.preventDefault(); close(); }
        else if (event.key === 'Tab') close();
    };
    toggle.onmousedown = event => event.preventDefault();
    toggle.onclick = () => {
        if (!list.hidden) close();
        else { input.focus(); show(''); input.select(); }
    };
    combo.append(input, toggle, list); field.append(label, combo, help, status);
    return field;
}

function journalFWCI(container, charts, journal, year, dataset, onSelect, onDrill) {
    const rows = journal.series.fwci || [], row = rows.find(r => r.year === year);
    const card = el('article', { class: 'panel journal-fwci', 'data-journal-fwci': '' });
    card.append(el('h3', {}, 'FWCI jurnal'), el('p', { class: 'panel-note' }, `Rerata FWCI karya yang terbit pada ${year} · seluruh afiliasi dan korpus terkumpul`));
    if (!row) { card.append(el('p', {}, 'FWCI jurnal belum tersedia pada snapshot ini.')); container.append(card); return; }
    card.append(el('div', { class: 'journal-ratio-value journal-fwci-value' }, ratio(row.value)),
        el('p', { class: 'journal-fwci-coverage' }, `${count(row.denominator)} dari ${count(row.total_documents)} karya memiliki FWCI valid · cakupan ${row.coverage === null ? 'Tidak tersedia' : ratio(row.coverage) + '%'}`),
        el('p', {}, row.denominator ? `Jumlah skor FWCI ${ratio(row.numerator)} ÷ ${count(row.denominator)} karya bermetrik. Nilai nol disertakan; skor kosong, negatif, atau tidak hingga dikecualikan.` : 'Tidak tersedia — tidak ada karya dengan FWCI valid pada tahun publikasi ini.'));
    if (row.window_incomplete) card.append(el('p', { class: 'journal-small-base' }, `Jendela sitasi ${year}–${year + 3} belum penuh pada tanggal snapshot. Skor dapat berubah.`));
    if (row.small_base) card.append(el('p', { class: 'journal-small-base' }, 'Basis dokumen kecil — kurang dari 30 karya bermetrik.'));
    const help = el('details', { class: 'fwci-help' });
    help.append(el('summary', {}, 'Arti FWCI dan cara pengukuran'),
        el('p', {}, 'FWCI (Field-Weighted Citation Impact) per karya = sitasi diterima ÷ sitasi yang diharapkan untuk karya dengan tahun, jenis, dan subbidang yang sama. Jendela mencakup tahun publikasi dan tiga tahun berikutnya. Skor per karya berasal dari OpenAlex; dashboard tidak menghitung ulang pembanding global.'),
        el('p', {}, 'FWCI jurnal di sini adalah rerata skor FWCI valid karya pada jurnal dan tahun publikasi terpilih. Cakupan = jumlah karya dengan FWCI valid ÷ seluruh karya jurnal pada tahun tersebut × 100%. Ini bukan rasio total sitasi dibagi total sitasi yang diharapkan, dan bukan skor kualitas setiap artikel.'),
        el('p', {}, 'Acuan 1 berarti rerata pembanding global; 2 berarti dua kali dan 0,5 separuhnya. Cakupan metadata dan jumlah karya perlu dipertimbangkan saat membaca hasil. Filter Jelajahi data tidak mengubah cakupan panel ini.'),
        link('Metode FWCI OpenAlex ↗', 'https://help.openalex.org/data/works/citations/'));
    card.append(help);
    if (row.denominator) card.append(drillButton('Telusuri karya dengan FWCI valid', journal.id, row, 'fwci', 'denominator', onDrill));
    container.append(card);
    const chart = panel(charts, 'Timeline FWCI jurnal', 'Rerata skor FWCI karya menurut tahun publikasi pada jurnal terpilih. Klik tahun untuk memperbarui metrik. Nilai kosong membentuk jeda; acuan global tetap 1.', true);
    chart.node.dataset.journalTimeline = 'fwci';
    line(chart, rows, { value: 'value', label: 'Rerata FWCI jurnal', color: PALETTE[2], unit: 'FWCI', reference: 1, referenceLabel: 'Acuan global FWCI 1',
        footer: `${journal.name} · Seluruh afiliasi dan korpus terkumpul · Snapshot ${dataset.updated_at}`,
        tooltip: r => `${r.year}: FWCI ${ratio(r.value)} · ${count(r.denominator)}/${count(r.total_documents)} karya · cakupan ${r.coverage === null ? 'Tidak tersedia' : ratio(r.coverage) + '%'}${r.window_incomplete ? ' · jendela sitasi belum penuh' : ''}${r.small_base ? ' · basis dokumen kecil' : ''}`,
        onClick: r => onSelect(journal.id, r.year) });
}

function formulaHelp(container, kind) {
    const details = el('details', { class: 'journal-formula' });
    details.append(el('summary', {}, 'Formula dan sumber data'));
    if (kind === 'four_year') {
        details.append(el('p', { class: 'journal-equation' }, 'R₄(Y) = sitasi pada Y−3…Y kepada dokumen layak terbitan Y−3…Y ÷ jumlah dokumen layak terbitan Y−3…Y.'),
            el('p', {}, 'Dokumen layak: artikel, review, makalah konferensi lengkap, bab buku, dan artikel data. Pembilang dan penyebut memakai jenis dokumen sasaran yang sama. Dataset bukan artikel data; abstrak konferensi bukan makalah lengkap.'),
            el('p', {}, 'Pemetaan metadata: article, review, conference-paper, proceedings-article (label lama), book-chapter, dan data-paper. Klasifikasi metadata tidak menjamin kesamaan klasifikasi atau seleksi dengan indeks lain.'),
            el('p', {}, 'Struktur formula mengacu pada metodologi CiteScore empat tahun. Nilainya dihitung sendiri dari indeks yang berbeda.'),
            link('Metodologi formulasi ↗', 'https://service.elsevier.com/app/answers/detail/a_id/14880/supporthub/scopus/'));
    } else {
        details.append(el('p', { class: 'journal-equation' }, 'R₂(Y) = sitasi pada Y kepada seluruh konten terpetakan terbitan Y−2 dan Y−1 ÷ jumlah artikel dan review terbitan Y−2 dan Y−1.'),
            el('p', {}, 'Sitasi kepada editorial, surat, dan konten lain dapat masuk pembilang. Penyebut hanya metadata article dan review. Karena kedua himpunan berbeda, nilai ini merupakan rasio terhadap artikel dan review, bukan rerata sitasi setiap artikel.'),
            el('p', {}, 'Struktur formula mengacu pada JIF standar dua tahun. Nilainya dihitung sendiri; 2yr_mean_citedness tidak digunakan.'),
            link('Metodologi formulasi ↗', 'https://clarivate.libguides.com/jcr/basics'));
    }
    details.append(el('p', {}, provenance), el('p', {}, 'Seluruh afiliasi dan korpus yang terkumpul disertakan; karya dipetakan ke sumber utama dan dihitung sekali per ID. Sitasi mandiri tercakup, flag retraksi dipertahankan. Nilai tinggi yang sah tidak dipotong. Jenis yang tidak dikenali tidak dipaksakan menjadi artikel/review.'),
        el('p', {}, 'Tahun tanpa entri sitasi diperlakukan nol hanya di dalam riwayat yang didukung. Timeline dibatasi agar seluruh jendela berada dalam cakupan sepuluh tahun. Nilai historis dapat berubah setelah pembaruan metadata.'),
        link('Dokumentasi sitasi tahunan ↗', 'https://help.openalex.org/data/works/attributes/'));
    container.append(details);
}
function link(label, href) { return el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label); }
function drillButton(label, source, row, kind, part, onDrill) {
    const button = el('button', { class: 'data-drill', type: 'button', 'data-journal-part': part }, label);
    button.onclick = () => onDrill(journalMetricDrill(source, row.year, kind, part));
    return button;
}
function breakdown(container, source, row, kind, onDrill) {
    const details = el('details', { class: 'journal-breakdown' });
    details.append(el('summary', {}, 'Rincian perhitungan'),
        el('p', {}, `${count(row.target_documents)} dokumen sasaran pembilang, termasuk yang memiliki nol sitasi. Jumlah dokumen sasaran berbeda dari jumlah sitasinya.`),
        el('p', {}, `${count(row.retracted)} dokumen berflag retraksi dan ${count(row.unknown_types)} dokumen dengan jenis tidak dikenali dalam jendela publikasi. Rincian mencakup jenis yang dikecualikan agar pemilihan penyebut dapat diperiksa.`));
    const actions = el('div', { class: 'journal-drill-actions' });
    actions.append(drillButton('Telusuri dokumen sasaran pembilang', source, row, kind, 'numerator', onDrill),
        drillButton('Telusuri dokumen penyebut', source, row, kind, 'denominator', onDrill));
    details.append(actions);
    const wrap = el('div', { class: 'table-scroll' }), table = el('table', { 'aria-label': `Rincian ${JOURNAL_TITLES[kind]}` }), head = el('thead'), tr = el('tr'), body = el('tbody');
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
    table.append(head, body); wrap.append(table); details.append(wrap); container.append(details);
}

export function renderJournalPanel(container, dataset, filter, onSelect, onDrill) {
    const section = el('section', { class: 'journal-metrics', 'aria-labelledby': 'journal-metrics-title' });
    section.append(el('h2', { id: 'journal-metrics-title' }, 'Dampak sitasi jurnal'));
    container.append(section);
    if (!dataset) {
        section.append(el('p', { class: 'empty-state' }, 'Dataset metrik jurnal belum tersedia pada snapshot ini.'));
        return;
    }
    section.append(el('p', { class: 'panel-note' }, 'Cakupan metrik: seluruh afiliasi dan korpus yang terkumpul pada jurnal terpilih. Periode mengikuti tahun metrik. Filter Jelajahi data hanya berlaku pada bagian eksplorasi lainnya.'));
    if (!dataset.journals.length) {
        section.append(el('p', { class: 'empty-state' }, 'Belum ada sumber bertipe jurnal yang terpetakan di bawah penerbit Unand.'));
        return;
    }
    const selected = journalSelection(dataset, filter), journal = dataset.journals.find(j => j.id === selected.source);
    const toolbar = el('div', { class: 'journal-toolbar' }), yearLabel = el('label', {}, 'Tahun metrik');
    const year = el('select', { id: 'journal-metric-year', 'aria-label': 'Tahun metrik sitasi' });
    for (const y of [...dataset.years].reverse()) year.append(el('option', { value: y }, `${y}${y === dataset.snapshot_year ? ' · Sementara — tahun belum lengkap' : ''}`));
    year.value = selected.year;
    year.onchange = () => onSelect(toolbar.querySelector('#journal-metric-source').dataset.source, Number(year.value));
    yearLabel.append(year); toolbar.append(journalPicker(dataset.journals, journal, source => onSelect(source, Number(year.value))), yearLabel); section.append(toolbar);
    section.append(el('p', { class: 'panel-note' }, `${journal.name} · ${journal.issn.length ? 'ISSN ' + journal.issn.join(', ') + ' · ' : ''}Data diperbarui: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(dataset.updated_at))} WIB. ${count(journal.excluded_publication_years)} dokumen tanpa tahun publikasi layak tidak digunakan.`));
    const cards = el('div', { class: 'journal-ratio-grid' }), charts = el('div', { class: 'charts-grid journal-timelines' });
    const fwciContainer = el('div');
    section.append(cards, fwciContainer, charts);
    for (const [i, kind] of ['four_year', 'two_year'].entries()) {
        const row = journal.series[kind].find(r => r.year === selected.year), title = JOURNAL_TITLES[kind];
        const card = el('article', { class: 'panel journal-ratio', 'data-journal-metric': kind });
        card.append(el('h3', {}, title), el('p', { class: 'panel-note' }, kind === 'four_year' ? 'Sitasi dan publikasi dalam jendela empat tahun yang sama' : 'Sitasi satu tahun kepada publikasi dua tahun sebelumnya'),
            el('div', { class: 'journal-ratio-value' }, ratio(row.value)),
            el('p', { class: 'journal-status' }, row.denominator === 0 ? 'Tidak tersedia — tidak ada dokumen penyebut' : row.status === 'provisional' ? 'Sementara — tahun belum lengkap' : 'Tahun kalender lengkap · data mengikuti snapshot'));
        if (row.small_base) card.append(el('p', { class: 'journal-small-base' }, 'Basis dokumen kecil — kurang dari 30 dokumen penyebut.'));
        const counts = el('dl', { class: 'journal-counts' });
        counts.append(el('dt', {}, kind === 'four_year' ? 'Sitasi dalam jendela 4 tahun' : 'Sitasi pada tahun metrik'),
            el('dd', { 'data-journal-count': 'numerator' }, count(row.numerator)),
            el('dt', {}, kind === 'four_year' ? 'Dokumen terbit dalam jendela 4 tahun' : 'Artikel dan review pada 2 tahun sebelumnya'),
            el('dd', { 'data-journal-count': 'denominator' }, count(row.denominator)));
        card.append(counts, el('p', {}, `Periode publikasi: ${period(row.publication_from, row.publication_to)}. ${kind === 'four_year' ? 'Periode sitasi' : 'Tahun sitasi'}: ${period(row.citation_from, row.citation_to)}.`),
            el('p', {}, kind === 'four_year' ? 'Rasio sitasi per dokumen dalam jendela pengamatan; setiap dokumen tidak selalu menerima jumlah sitasi yang sama.' : 'Pembilang mencakup konten lebih luas daripada penyebut. Nilai ini bukan rerata sitasi setiap artikel.'));
        formulaHelp(card, kind); breakdown(card, journal.id, row, kind, onDrill); cards.append(card);
        const chart = panel(charts, `Timeline ${title.toLowerCase()}`, kind === 'four_year'
            ? 'Jendela empat tahun bergeser dan saling tumpang tindih. Klik tahun untuk memperbarui kedua panel. Skor kosong membentuk jeda.'
            : 'Setiap titik memakai sitasi pada tahun metrik kepada konten dua tahun sebelumnya. Klik tahun untuk memperbarui kedua panel. Skor kosong membentuk jeda.');
        chart.node.dataset.journalTimeline = kind;
        line(chart, journal.series[kind], { value: 'value', label: title, color: PALETTE[i === 0 ? 0 : 3], unit: 'sitasi per dokumen pembagi',
            footer: `${journal.name} · Seluruh afiliasi dan korpus terkumpul · Snapshot ${dataset.updated_at}`,
            tooltip: r => `${r.year}${r.status === 'provisional' ? ' (sementara)' : ''}: ${ratio(r.value)} · ${count(r.numerator)} sitasi ÷ ${count(r.denominator)} dokumen · publikasi ${period(r.publication_from, r.publication_to)} · sitasi ${period(r.citation_from, r.citation_to)}${r.small_base ? ' · basis dokumen kecil' : ''}`,
            onClick: r => onSelect(journal.id, r.year) });
    }
    journalFWCI(fwciContainer, charts, journal, selected.year, dataset, onSelect, onDrill);
}
