/*! Copyright (c) 2026 Ikhwan Arief (ikhwan[at]eng.unand.ac.id). All rights reserved.
 * Licensed under the PolyForm Noncommercial License 1.0.0
 * (https://polyformproject.org/licenses/noncommercial/1.0.0). Commercial use requires prior
 * written permission from the copyright holder. See LICENSE and NOTICE. */
import {csvCell, SDG_COLORS} from './metrics.js';
export const PALETTE = ['#28745B', '#B8934A', '#368C88', '#587AA5', '#8A7098', '#9BAE96', '#49705F', '#C4AB76', '#7F9DAD', '#B3A6B8'];
export const OA_COLORS = { diamond: '#28745B', gold: '#B8934A', hybrid: '#587AA5', green: '#7DA286', bronze: '#A57D54', closed: '#ADB5AD', unknown: '#DBDFDA' };
const instances = [];
const integer = new Intl.NumberFormat('id-ID');
const decimal = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const colorFor = (id, index = 0) => OA_COLORS[id] || PALETTE[id ? [...String(id)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0) % PALETTE.length : index % PALETTE.length];
function ink(color) { const rgb = color.slice(1).match(/../g).map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return 1.05 / (rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 + .05) >= 4.5 ? '#ffffff' : '#000000'; }
const NS = 'http://www.w3.org/2000/svg';
export const el = (tag, attrs = {}, text) => { const node = document.createElement(tag); for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, value); if (text !== undefined)
    node.textContent = text; return node; };
const svgEl = (tag, attrs = {}, text) => { const node = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, value); if (text !== undefined)
    node.textContent = text; return node; };
export function destroyCharts() { for (const chart of instances)
    chart.destroy(); instances.length = 0; }
export function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), a = el('a', { href: url, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function downloadText(text, name, type = 'text/plain') { downloadBlob(new Blob([text], { type }), name); }
// SJR Best Quartile (SCImago) per OpenAlex source ID, loaded once from data/sjr.json.
// Sources without a quartile get no label at all.
let sjr = { edition: null, sources: {} };
export function setSJR(value) { sjr = value?.sources ? value : { edition: null, sources: {} }; }
export const sjrQuartile = id => (id && sjr.sources[id]) || null;
export const sjrEdition = () => sjr.edition;
export function sjrBadge(id) {
    const q = sjrQuartile(id);
    return q ? el('span', { class: `sjr-badge sjr-${q.toLowerCase()}`, title: `Kuartil terbaik (SJR Best Quartile) jurnal ini pada SCImago Journal Rank edisi ${sjr.edition}. Edisi yang sama dipakai untuk semua tahun terbit.` }, `${q} · SJR ${sjr.edition}`) : null;
}
// Chart labels are canvas text: the quartile is a prefix so truncation never cuts it off.
export const sjrName = (id, name) => { const q = sjrQuartile(id); return q ? `${q} · ${name}` : name; };
export function panel(grid, title, note = '', wide = false) {
    const node = el('section', { class: `panel${wide ? ' wide' : ''}` });
    const head = el('div', { class: 'panel-head' }), labels = el('div'), actions = el('div', { class: 'panel-actions' });
    labels.append(el('h2', {}, title));
    if (note)
        labels.append(el('p', {}, note));
    head.append(labels, actions);
    const body = el('div', { class: 'chart-body' });
    node.append(head, body);
    grid.append(node);
    return { node, body, actions, title };
}
export function empty(p, message = 'Data tidak tersedia untuk filter ini.') { p.body.replaceChildren(); p.body.append(el('div', { class: 'empty-state' }, message)); }
function accessible(p, rows, onClick) {
    const detail = el('details', { class: 'chart-data' });
    detail.append(el('summary', {}, 'Lihat angka diagram'));
    const list = el('ul');
    for (const r of rows) {
        const li = el('li'), label = r.description || `${r.name}: ${decimal.format(r.count ?? r.value ?? 0)}`;
        if (onClick) {
            const button = el('button', { type: 'button', class: 'data-drill' }, label);
            button.onclick = () => onClick(r);
            li.append(button);
        }
        else
            li.textContent = label;
        list.append(li);
    }
    detail.append(list);
    p.node.append(detail);
}
function exportControl(p) {
    const button = el('button', { class: 'chart-export', type: 'button', 'aria-label': `Unduh diagram ${p.title}` }, '↓ Gambar');
    button.onclick = () => {
        const canvas = p.body.querySelector('canvas'), svg = p.body.querySelector('svg');
        if (canvas)
            canvas.toBlob(blob => blob && downloadBlob(blob, `${p.title}.png`));
        else if (svg)
            downloadText(new XMLSerializer().serializeToString(svg), `${p.title}.svg`, 'image/svg+xml');
    };
    p.actions.append(button);
}
function chart(p, type, data, options = {}) {
    if (!globalThis.Chart) {
        empty(p, 'Pustaka diagram belum dapat dimuat. Muat ulang halaman.');
        return;
    }
    const canvas = el('canvas', { role: 'img', 'aria-label': p.title });
    p.body.append(canvas);
    // Line and bar charts show the tooltip for the nearest year column, so values appear without hitting a point exactly.
    if ((type === 'line' || type === 'bar') && !options.interaction)
        options = { ...options, interaction: { mode: 'nearest', axis: options.indexAxis === 'y' ? 'y' : 'x', intersect: false } };
    const plugins=options.plugins||{},tooltip=plugins.tooltip||{};
    options={...options,plugins:{...plugins,legend:{display:false,...plugins.legend},tooltip:{backgroundColor:'#183D34',padding:11,cornerRadius:8,...tooltip,callbacks:{footer:()=>p.title.startsWith('Riwayat')?['Filter default masing-masing snapshot']:[...(document.querySelector('.scope-line span')?.textContent?.split(' · ')||[]),document.querySelector('.scope-line strong')?.textContent||''],...tooltip.callbacks}}}};
    const c = new Chart(canvas, { type, data, options: { responsive: true, maintainAspectRatio: false,
            animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 250 },
            font: { family: 'system-ui' }, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#183D34', padding: 11, cornerRadius: 8, callbacks: { footer: () => document.querySelector('.scope-line')?.textContent || '' } } },
            scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#63736b' } }, y: { beginAtZero: true, grid: { color: '#edf0e9' }, border: { display: false }, ticks: { font: { size: 10 }, color: '#63736b', precision: 0 } } }, ...options } });
    instances.push(c);
    exportControl(p);
    return c;
}
export function bar(p, rows, { horizontal = true, onClick, color, limit = 10, value = 'count', unit = 'karya' } = {}) {
    rows = rows.slice(0, limit);
    if (!rows.length) {
        empty(p);
        return;
    }
    chart(p, 'bar', { labels: rows.map(r => r.name.length > 34 ? r.name.slice(0, 32) + '…' : r.name), datasets: [{ data: rows.map(r => r[value] ?? 0),
                backgroundColor: rows.map((r, i) => color || colorFor(r.id, i)), borderRadius: 4, maxBarThickness: 24 }] }, { indexAxis: horizontal ? 'y' : 'x', scales: horizontal ? { x: { beginAtZero: true, grid: { color: '#edf0e9' }, ticks: { font: { size: 9 }, precision: 0 } }, y: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#526358' }, border: { display: false } } } : undefined,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#183D34', callbacks: { label: c => `${rows[c.dataIndex].name}: ${decimal.format(rows[c.dataIndex][value] ?? 0)} ${unit}` } } },
        onClick: (_e, elements) => elements[0] && onClick?.(rows[elements[0].index]),
        onHover: (e, elements) => { if (e.native?.target)
            e.native.target.style.cursor = elements.length && onClick ? 'pointer' : 'default'; } });
    accessible(p, rows.map(r => ({ ...r, count: r[value], description: `${r.name}: ${decimal.format(r[value] ?? 0)} ${unit}` })), onClick);
}
export function line(p, rows, { onClick, value = 'count', label = 'Publikasi', color = PALETTE[0], percent = false, unit='karya', reference = null, referenceLabel, tooltip, footer } = {}) {
    if (!rows.length || !rows.some(r => Number.isFinite(r[value]))) {
        empty(p);
        return;
    }
    const datasets = [{ label, data: rows.map(r => r[value] ?? null), borderColor: color,
        backgroundColor: color + '12', fill: true, tension: .25, pointRadius: 3, pointHoverRadius: 6, borderWidth: 2 }];
    if (Number.isFinite(reference)) datasets.push({ label: referenceLabel || `Acuan ${unit} ${reference}`, data: rows.map(() => reference),
        borderColor: '#947337', borderDash: [6, 5], pointRadius: 0, borderWidth: 1.5, fill: false });
    chart(p, 'line', { labels: rows.map(r => r.name ?? r.year ?? r.id), datasets }, {
        plugins: { legend: { display: Number.isFinite(reference), position: 'bottom' }, tooltip: { callbacks: {
            label: c => c.datasetIndex === 0 && tooltip ? tooltip(rows[c.dataIndex]) : `${c.dataset.label}: ${decimal.format(c.raw)} ${percent ? '%' : unit}`,
            ...(footer ? { footer: () => footer } : {}),
        } } },
        onClick: (_e, e) => e[0]?.datasetIndex === 0 && onClick?.(rows[e[0].index]), scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 12 } }, y: { beginAtZero: true, max: percent ? 100 : undefined, grid: { color: '#edf0e9' }, ticks: { font: { size: 9 } } } } });
    accessible(p, rows.map(r => ({ ...r, name: String(r.name ?? r.year ?? r.id), count: r[value], description: tooltip ? tooltip(r) : `${r.name??r.year??r.id}: ${Number.isFinite(r[value]) ? decimal.format(r[value]) + ' ' + (percent?'%':unit) : 'Tidak tersedia'}` })), onClick);
}
export function timelineYears(rows, availableYears, range = '10', { individual = false, omitEmpty = false } = {}) {
    const activeYears = [...new Set(availableYears)].filter(year => rows.some(row => row.years[year] > 0)).sort((a, b) => a - b);
    if (!activeYears.length) return rows.map(() => []);
    const last = activeYears.at(-1), first = range === 'all' ? activeYears[0] : Math.max(activeYears[0], last - Number(range) + 1);
    const window = Array.from({ length: last - first + 1 }, (_, i) => first + i);
    const shared = omitEmpty ? window.filter(year => rows.some(row => row.years[year] > 0)) : window;
    return rows.map(row => {
        if (!individual) return shared;
        const activity = window.filter(year => row.years[year] > 0);
        return activity.length ? window.filter(year => year >= activity[0] && year <= activity.at(-1)) : [];
    });
}
export function smallMultiples(p, allRows, availableYears, onClick, options = {}) {
    const rows = allRows.slice(0, 10);
    const activeYears = availableYears.filter(year => rows.some(row => row.years[year] > 0));
    if (!rows.length || !activeYears.length) { empty(p); return; }
    p.node.classList.add('small-multiples-panel');
    p.body.className = 'small-multiples';
    const controls = el('label', { class: 'series-controls' }, 'Rentang grafik');
    const select = el('select', { 'aria-label': `Rentang grafik ${p.title}` });
    for (const [value, label] of [['10', '10 tahun terakhir'], ['20', '20 tahun terakhir'], ['all', 'Seluruh rentang']]) select.append(el('option', { value }, label));
    controls.append(select, el('span', {}, 'Peringkat mengikuti seluruh filter aktif.'));
    p.node.insertBefore(controls, p.body);
    let currentCharts = [];
    const draw = () => {
        for (const c of currentCharts) { c.destroy(); const index = instances.indexOf(c); if (index >= 0) instances.splice(index, 1); }
        currentCharts = [];
        p.body.replaceChildren();
        const rowYears = timelineYears(rows, availableYears, select.value, options);
        const maximum = Math.max(1, ...rows.flatMap((row, index) => rowYears[index].map(year => row.years[year] || 0)));
        rows.forEach((row, index) => {
            const years = rowYears[index];
            const card = el('section', { class: 'mini-series', 'data-entity': row.id }), head = el('div', { class: 'mini-series-head' }), actions = el('div', { class: 'panel-actions' });
            const labels = el('div'), visible = years.reduce((sum, year) => sum + (row.years[year] || 0), 0);
            labels.append(el('h3', {}, `${index + 1}. ${row.name}`), el('span', { class: 'mini-series-meta' }, `${integer.format(row.count)} karya dalam filter${years.length ? ` · ${integer.format(visible)} pada ${years[0]}–${years.at(-1)}` : ''}`));
            head.append(labels, actions);
            const body = el('div', { class: 'mini-series-body' });
            card.append(head, body);
            p.body.append(card);
            if (!years.length) { body.append(el('p', { class: 'empty-state' }, 'Tidak ada publikasi dalam rentang grafik ini.')); return; }
            const points = years.map(year => ({ year, count: row.years[year] || 0 }));
            const mini = { node: card, body, actions, title: row.name };
            const c = chart(mini, 'line', { labels: years, datasets: [{ label: row.name, data: points.map(point => point.count),
                borderColor: options.colorOf?.(row) || PALETTE[0], backgroundColor: (options.colorOf?.(row) || '#28745B') + '12', fill: true, tension: 0, pointRadius: 2.5, pointHoverRadius: 5, borderWidth: 2 }] }, {
                scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 5 } },
                    y: { beginAtZero: true, max: Math.ceil(maximum * 1.1), ticks: { precision: 0, font: { size: 9 } }, grid: { color: '#edf0e9' } } },
                plugins: { tooltip: { callbacks: { label: ctx => `${row.name}: ${integer.format(ctx.raw)} karya pada ${years[ctx.dataIndex]}` } } },
                onClick: (_event, items) => items[0] && onClick?.(row, years[items[0].index]),
            });
            if (c) currentCharts.push(c);
            accessible(mini, points.map(point => ({ ...point, description: `${point.year}: ${integer.format(point.count)} karya · ${row.name}` })), point => onClick?.(row, point.year));
        });
    };
    select.onchange = draw;
    draw();
}
// `unit` names what a bubble counts: shared publications on Kolaborasi, works on a journal page.
export function countryBubbleMap(p, rows, geography, { unit = 'publikasi bersama' } = {}) {
    if (!rows.length) { empty(p); return; }
    p.node.classList.add('world-map-panel');
    const project = (lon, lat) => [(lon + 180) * 960 / 360, (85 - lat) * 420 / 145];
    const svg = svgEl('svg', { viewBox: '0 0 960 420', role: 'group', 'aria-label': `Peta jumlah ${unit} per negara`, xmlns: NS });
    svg.append(svgEl('rect', { x: 0, y: 0, width: 960, height: 420, fill: '#edf4f5' }));
    for (const d of geography.borders) svg.append(svgEl('path', { d, fill: '#d8e3d9', stroke: '#ffffff', 'stroke-width': .65, 'vector-effect': 'non-scaling-stroke' }));
    const tooltip = el('p', { class: 'map-tooltip', role: 'status', 'aria-live': 'polite' }, 'Arahkan penunjuk atau fokuskan bubble untuk melihat nama negara dan jumlah karya.');
    const popup = el('div', { class: 'map-popup', role: 'tooltip', hidden: '' });
    const show = (row, group) => {
        const label = `${row.name} (${row.id}): ${integer.format(row.count)} ${unit} · ${integer.format(row.citations)} sitasi`;
        tooltip.textContent = label;
        popup.textContent = label;
        popup.hidden = false;
        const bounds = p.body.getBoundingClientRect(), bubble = group?.getBoundingClientRect();
        const width = popup.getBoundingClientRect().width;
        const left = bubble ? bubble.x - bounds.x + bubble.width / 2 : bounds.width / 2;
        const top = bubble ? bubble.y - bounds.y : bounds.height / 2;
        popup.style.left = Math.max(8, Math.min(bounds.width - width - 8, left - width / 2)) + 'px';
        popup.style.top = Math.max(8, Math.min(bounds.height - popup.offsetHeight - 8, top - popup.offsetHeight - 10)) + 'px';
    };
    const hide = () => { popup.hidden = true; };
    p.node.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
    const mapped = rows.filter(row => geography.countries[row.id]), missing = rows.filter(row => !geography.countries[row.id]);
    const maximum = Math.max(1, ...mapped.map(row => row.count));
    for (const row of [...mapped].sort((a, b) => b.count - a.count)) {
        const position = geography.countries[row.id], [cx, cy] = project(position.lon, position.lat);
        const radius = 28 * Math.sqrt(row.count / maximum), label = `${row.name} (${row.id}): ${integer.format(row.count)} ${unit} · ${integer.format(row.citations)} sitasi`;
        const group = svgEl('g', { class: 'country-bubble', 'data-country': row.id, tabindex: 0, role: 'img', 'aria-label': label });
        group.append(svgEl('title', {}, label), svgEl('circle', { cx, cy, r: Math.max(7, radius), fill: 'transparent' }),
            svgEl('circle', { class: 'bubble-dot', cx, cy, r: radius, fill: '#28745b', 'fill-opacity': .62, stroke: '#ffffff', 'stroke-width': 1.1, 'vector-effect': 'non-scaling-stroke' }));
        group.onpointerenter = group.onfocus = group.onclick = () => show(row, group);
        group.onpointerleave = group.onblur = hide;
        group.onkeydown = event => {
            if (event.key === 'Escape') hide();
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); show(row, group); }
        };
        svg.append(group);
    }
    const controls = el('div', { class: 'map-controls' }), region = el('select', { 'aria-label': 'Wilayah peta' });
    const regions = { world: ['Dunia', [0, 0, 960, 420]], asia: ['Asia', [590, 0, 350, 310]], europe: ['Eropa', [440, 5, 220, 200]],
        africa: ['Afrika', [425, 100, 230, 260]], americas: ['Amerika', [0, 0, 420, 420]], oceania: ['Oseania', [730, 220, 230, 200]] };
    for (const [value, [label]] of Object.entries(regions)) region.append(el('option', { value }, label));
    let view = [...regions.world[1]];
    const draw = () => { hide(); svg.setAttribute('viewBox', view.join(' ')); };
    region.onchange = () => { view = [...regions[region.value][1]]; draw(); };
    const zoom = factor => { const [x, y, width, height] = view, next = Math.max(60, Math.min(960, width * factor)), ratio = height / width;
        view = next >= 960 || next * ratio >= 420 ? [...regions.world[1]]
            : [Math.max(0, Math.min(960 - next, x + (width - next) / 2)), Math.max(0, Math.min(420 - next * ratio, y + (height - next * ratio) / 2)), next, next * ratio]; draw(); };
    const plus = el('button', { type: 'button', class: 'button secondary', 'aria-label': 'Perbesar peta' }, '+');
    const minus = el('button', { type: 'button', class: 'button secondary', 'aria-label': 'Perkecil peta' }, '−');
    plus.onclick = () => zoom(.7); minus.onclick = () => zoom(1 / .7);
    const reset = el('button', { type: 'button', class: 'text-button' }, 'Tampilan dunia');
    reset.onclick = () => { region.value = 'world'; region.onchange(); };
    controls.append(region, plus, minus, reset);
    const choose = el('select', { 'aria-label': 'Pilih negara pada peta' });
    choose.append(el('option', { value: '' }, 'Lihat data negara · tanpa mengubah filter'));
    for (const row of rows) choose.append(el('option', { value: row.id }, `${row.name} · ${integer.format(row.count)} karya`));
    choose.onchange = () => { const row = rows.find(row => row.id === choose.value); if (row) show(row, null); else hide(); };
    controls.append(choose);
    p.body.append(svg, popup);
    p.node.insertBefore(controls, p.body);
    p.node.append(tooltip, el('p', { class: 'panel-note' },
        `${integer.format(mapped.length)} negara/area dipetakan. Luas bubble proporsional terhadap jumlah karya; terbesar ${integer.format(maximum)} karya. Posisi memakai titik label negara, bukan lokasi kampus. Geografi: Natural Earth (public domain).${missing.length ? ' Koordinat belum tersedia: ' + missing.map(row => row.name).join(', ') + '.' : ''}`));
    exportControl(p);
    accessible(p, rows.map(row => ({ ...row, description: `${row.name} (${row.id}): ${integer.format(row.count)} ${unit} · ${integer.format(row.citations)} sitasi` })));
}
export function donut(p, rows, onClick) {
    if (!rows.length) {
        empty(p);
        return;
    }
    const total = rows.reduce((n, r) => n + r.count, 0);
    chart(p, 'doughnut', { labels: rows.map(r => r.name), datasets: [{ data: rows.map(r => r.count), backgroundColor: rows.map((r, i) => colorFor(r.id, i)), borderColor: '#fff', borderWidth: 3 }] }, { cutout: '72%', scales: {}, plugins: { legend: { display: true, position: 'right', labels: { boxWidth: 9, boxHeight: 9, usePointStyle: true, padding: 14, font: { size: 10 } } }, tooltip: { backgroundColor: '#183D34', padding: 10, callbacks: { label: c => `${c.label}: ${integer.format(c.raw)} karya / ${integer.format(total)} (${decimal.format(total ? c.raw / total * 100 : 0)}%)` } } }, onClick: (_e, e) => e[0] && onClick?.(rows[e[0].index]) });
    accessible(p, rows, onClick);
}
export function stacked(p, years, series, { percentage = false, horizontal = false, onClick } = {}) {
    if (!years.length) {
        empty(p);
        return;
    }
    // Only horizontal bars shorten labels; an explicit undefined callback would hide vertical category labels (years).
    const categoryAxis = { stacked: true, grid: { display: false }, ticks: { font: { size: 10 },
        ...(horizontal ? { callback: function (value) { const label = String(this.getLabelForValue(value)), limit = this.chart.width < 500 ? 22 : 45; return label.length > limit ? label.slice(0, limit - 2) + '…' : label; } } : {}) } };
    const valueAxis = { stacked: true, beginAtZero: true, max: percentage ? 100 : undefined, grid: { color: '#edf0e9' },
        ticks: { font: { size: 9 }, callback: percentage ? value => value + '%' : undefined } };
    chart(p, 'bar', { labels: years.map(y => y.year), datasets: series.map((s, i) => ({ label: s.name,
            data: years.map(y => percentage ? (y.total ? ((y.values[s.id] || 0) / y.total) * 100 : 0) : y.values[s.id] || 0),
            backgroundColor: colorFor(s.id, i), maxBarThickness: 45, borderRadius: 2 })) }, { indexAxis: horizontal ? 'y' : 'x', scales: { x: horizontal ? valueAxis : categoryAxis, y: horizontal ? categoryAxis : valueAxis },
        plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, font: { size: 9 }, padding: 10 } }, tooltip: { backgroundColor: '#183D34', callbacks: { label: c => { const y = years[c.dataIndex], s = series[c.datasetIndex]; return `${s.name}: ${integer.format(y.values[s.id] || 0)} karya / ${integer.format(y.total)}${percentage ? ' · ' + decimal.format(c.raw) + '%' : ''}`; } } } },
        onClick: (_e, e) => { if (e[0])
            onClick?.(years[e[0].index], series[e[0].datasetIndex]); } });
    accessible(p, years.flatMap(y => series.map(s => ({ name: `${y.year} · ${s.name}`, count: y.values[s.id] || 0,
        description: `${y.year} · ${s.name}: ${integer.format(y.values[s.id] || 0)} dari ${integer.format(y.total)} karya${percentage ? ' · ' + decimal.format(y.total ? (y.values[s.id] || 0) / y.total * 100 : 0) + '%' : ''}`,
        year: y, series: s }))), onClick ? r => onClick(r.year, r.series) : undefined);
}
// SDG list with the official full icons (number, title and pictogram; scaled, never cropped) and goal-coloured bars.
// rows: { id: '1'..'17', name, count }; the order is kept as given.
export function sdgBars(p, rows, { onClick, limit = 17 } = {}) {
    const list = rows.slice(0, limit), max = Math.max(1, ...list.map(r => r.count || 0));
    p.body.style.height = 'auto';
    if (!list.length || !list.some(r => r.count)) { empty(p); return; }
    const box = el('ol', { class: 'sdg-bars' });
    for (const r of list) {
        const n = Number(r.id), item = el('li'), button = el('button', { type: 'button', class: 'sdg-bar', 'data-sdg': r.id, 'aria-label': `${r.name}: ${integer.format(r.count || 0)} karya` });
        const icon = el('img', { src: `assets/sdg/sdg-${n}.png`, alt: `SDG ${n}`, width: '40', height: '40', loading: 'lazy' });
        const track = el('span', { class: 'sdg-bar-track' }), fill = el('span', { class: 'sdg-bar-fill' });
        fill.style.width = `${(r.count || 0) / max * 100}%`; fill.style.background = SDG_COLORS[n - 1];
        track.append(fill);
        const label = el('span', { class: 'sdg-bar-label' });
        label.append(el('span', { class: 'sdg-bar-name' }, r.name), track);
        button.append(icon, label, el('span', { class: 'sdg-bar-count' }, integer.format(r.count || 0)));
        if (onClick) button.onclick = () => onClick(r); else button.disabled = true;
        item.append(button); box.append(item);
    }
    p.body.append(box);
}
export function scatter(p, rows, { x = 'count', y = 'citations', xTitle = 'Publikasi', yTitle = 'Sitasi', onClick, bubble = false, colorOf } = {}) {
    rows = rows.filter(r => Number.isFinite(r[x]) && Number.isFinite(r[y]));
    if (!rows.length) {
        empty(p);
        return;
    }
    chart(p, bubble ? 'bubble' : 'scatter', { datasets: [{ label: p.title, data: rows.map(r => ({ x: r[x], y: r[y], r: Math.max(4, Math.min(20, Math.sqrt(r.count || 1) * 1.3)) })), backgroundColor: rows.map((r, i) => (colorOf?.(r) || colorFor(r.id, i)) + 'B3'), borderWidth: 1, borderColor: '#fff', pointRadius: 5 }] }, { scales: { x: { beginAtZero: true, title: { display: true, text: xTitle, font: { size: 10 } }, grid: { color: '#edf0e9' }, ticks: { font: { size: 9 } } }, y: { beginAtZero: true, title: { display: true, text: yTitle, font: { size: 10 } }, grid: { color: '#edf0e9' }, ticks: { font: { size: 9 } } } },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#183D34', callbacks: { label: ctx => `${rows[ctx.dataIndex].name || rows[ctx.dataIndex].title}: ${xTitle} ${decimal.format(ctx.parsed.x)}, ${yTitle} ${decimal.format(ctx.parsed.y)}` } } },
        onClick: (_e, e) => e[0] && onClick?.(rows[e[0].index]) });
    accessible(p, rows.slice(0, 50).map(r => ({ ...r, description: `${r.name || r.title}: ${xTitle} ${decimal.format(r[x])}; ${yTitle} ${decimal.format(r[y])}` })), onClick);
}
export function hIndexCurve(p, metric, onClick) {
    // Karya tanpa sitasi tidak digambar; nilai h dan jumlah karya aktif tetap dari seluruh karya.
    const rows = (metric?.points || []).filter(row => row.citations > 0);
    if (!rows.length) {
        empty(p, metric?.points?.length ? 'Belum ada karya yang disitasi untuk filter ini.' : 'Tidak ada karya untuk filter ini.');
        return;
    }
    const core = rows.filter(row => row.in_h_core), outside = rows.filter(row => !row.in_h_core);
    // The threshold line stops at the highest citation count so the y-axis fits the data, not the work count.
    const maxAxis = Math.max(...rows.map(row => row.citations), 1);
    const pointData = group => group.map(row => ({ x: row.rank, y: row.citations }));
    const datasets = [
        { label: 'Ambang h: sitasi = peringkat', type: 'line', data: [{ x: 0, y: 0 }, { x: maxAxis, y: maxAxis }],
            borderColor: '#947337', borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0, fill: false },
        { label: 'Termasuk h-core', data: pointData(core), _rows: core, backgroundColor: '#B8934A', borderColor: '#6D5424', borderWidth: 1.5, pointRadius: 5, pointHoverRadius: 8 },
        { label: 'Di luar h-core', data: pointData(outside), _rows: outside, backgroundColor: '#28745BB3', borderColor: '#ffffff', borderWidth: 1, pointRadius: 4, pointHoverRadius: 7 },
    ];
    chart(p, 'scatter', { datasets }, { interaction: { mode: 'nearest', intersect: true },
        scales: {
            x: { beginAtZero: true, title: { display: true, text: 'Peringkat artikel berdasarkan sitasi', font: { size: 10 } }, grid: { color: '#edf0e9' }, ticks: { precision: 0, font: { size: 9 } } },
            y: { beginAtZero: true, title: { display: true, text: 'Jumlah sitasi kumulatif', font: { size: 10 } }, grid: { color: '#edf0e9' }, ticks: { precision: 0, font: { size: 9 } } },
        },
        plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } }, tooltip: { callbacks: {
            title: items => items[0]?.dataset?._rows?.[items[0].dataIndex]?.title || items[0]?.dataset.label || '',
            label: ctx => { const row = ctx.dataset._rows?.[ctx.dataIndex]; return row ? [
                `${row.year ?? 'Tahun tidak tersedia'} · peringkat ${integer.format(row.rank)}`,
                `${integer.format(row.citations)} sitasi · ${row.in_h_core ? 'Termasuk h-core' : 'Di luar h-core'}`,
                'Klik untuk membuka rincian artikel',
            ] : ctx.dataset.label; },
        } } },
        onClick: (_event, items) => { const item = items[0], row = item && datasets[item.datasetIndex]._rows?.[item.index]; if (row) onClick?.(row); },
        onHover: (event, items) => { if (event.native?.target) event.native.target.style.cursor = items.some(item => datasets[item.datasetIndex]._rows) ? 'pointer' : 'default'; },
    });
    const canvas = p.body.querySelector('canvas');
    canvas?.setAttribute('aria-label', `Kurva h-index ${metric.value}: peringkat artikel pada sumbu X dan jumlah sitasi pada sumbu Y`);
    accessible(p, rows.map(row => ({ ...row, description: `Peringkat ${integer.format(row.rank)} — ${row.title} — ${integer.format(row.citations)} sitasi — ${row.in_h_core ? 'termasuk h-core' : 'di luar h-core'}` })), onClick);
}
export function heatmap(p, rows, years, onCell) {
    rows = rows.slice(0, 10);
    if (!rows.length || !years.length) {
        empty(p);
        return;
    }
    p.body.classList.add('tall');
    const wrap = el('div', { class: 'heatmap-wrap' }), grid = el('div', { class: 'heatmap' });
    grid.style.gridTemplateColumns = `minmax(120px,1.5fr) repeat(${years.length}, minmax(35px,1fr))`;
    grid.append(el('span'));
    for (const y of years)
        grid.append(el('span', { class: 'heat-year' }, String(y)));
    const max = Math.max(1, ...rows.flatMap(r => years.map(y => r.years[y] || 0)));
    for (const row of rows) {
        grid.append(el('span', { class: 'heat-label', title: row.name }, row.name));
        for (const year of years) {
            const count = row.years[year] || 0, cell = el('button', { class: 'heat-cell', type: 'button', title: `${row.name} · ${year}: ${integer.format(count)} karya`, 'aria-label': `${row.name}, ${year}, ${count} karya` }, integer.format(count));
            const strength = count / max, alpha=.06+strength*.88;
            const shade='#'+[40,116,91].map(c=>Math.round(c*alpha+255*(1-alpha)).toString(16).padStart(2,'0')).join('');
            cell.style.backgroundColor = shade;
            cell.style.color = ink(shade);
            cell.onclick = () => onCell?.(row, year);
            grid.append(cell);
        }
    }
    wrap.append(grid, el('div', { class: 'heat-legend' }, 'Warna semakin pekat menunjukkan lebih banyak karya. Klik sel untuk menelusuri publikasi.'));
    p.body.append(wrap);
    accessible(p, rows);
    const b = el('button', { class: 'chart-export', type: 'button' }, '↓ CSV');
    b.onclick = () => downloadText([['Kategori','Tahun','Karya'],...rows.flatMap(r => years.map(y => [r.name,y,r.years[y]||0]))].map(row=>row.map(csvCell).join(',')).join('\r\n'), p.title + '.csv', 'text/csv');
    p.actions.append(b);
}
export function dots(p, rows, onClick) {
    if (!rows.length) {
        empty(p);
        return;
    }
    const svg = svgEl('svg', { viewBox: '0 0 800 340', role: 'img', 'aria-label': p.title, xmlns: NS });
    for (let value = 0; value <= 100; value += 25) {
        const x = 290 + value * 4.6;
        svg.append(svgEl('line', { x1: x, y1: 20, x2: x, y2: 290, stroke: '#e5eae1' }), svgEl('text', { x, y: 320, 'text-anchor': 'middle', 'font-size': 16, fill: '#526358' }, value + '%'));
    }
    rows.forEach((r, index) => { const y = 45 + index * 48, g = svgEl('g', { role: 'button', tabindex: 0, 'aria-label': `${r.name}: ${decimal.format(r.count)} persen` }); g.append(svgEl('text', { x: 10, y: y + 5, 'font-size': 17, fill: '#25332d', 'font-family': 'system-ui' }, r.name), svgEl('line', { x1: 290, y1: y, x2: 290 + r.count * 4.6, y2: y, stroke: '#c9d8ca', 'stroke-width': 4 }), svgEl('circle', { cx: 290 + r.count * 4.6, cy: y, r: 8, fill: colorFor(r.id, index) }), svgEl('title', {}, `${r.name}: ${decimal.format(r.count)}%`)); g.onclick = () => onClick?.(r); g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.(r);
    } }; svg.append(g); });
    p.body.append(svg);
    exportControl(p);
    accessible(p, rows, onClick);
}
export function treemap(p, allRows, onClick) {
    const rows = allRows.slice(0, 12).map(r => ({ ...r })), rest = allRows.slice(12).reduce((n, r) => n + r.count, 0);
    if (rest)
        rows.push({ id: '', name: 'Bidang lainnya', count: rest });
    if (!rows.length || !rows.some(r => r.count)) {
        empty(p);
        return;
    }
    p.body.classList.add('tall');
    // Digambar sesuai ukuran kotak sebenarnya (1 unit = 1 px), sehingga petak memenuhi lebar dan label tetap terbaca.
    const W = Math.max(280, Math.round(p.body.clientWidth || 800)), H = Math.max(220, Math.round(p.body.clientHeight || 340));
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': p.title, xmlns: NS });
    const fontSize = W < 520 ? 12 : 14;
    function divide(items, x, y, w, h) {
        if (items.length === 1) {
            const row = items[0], i = rows.indexOf(row), g = svgEl('g', { class: 'treemap-tile', tabindex: '0', role: 'button', 'aria-label': `${row.name}: ${row.count} karya` });
            g.append(svgEl('rect', { x: x + 2, y: y + 2, width: Math.max(0, w - 4), height: Math.max(0, h - 4), rx: 5, fill: colorFor(row.id, i) }));
            g.append(svgEl('title', {}, `${row.name}: ${integer.format(row.count)} karya`));
            if (w > 65 && h > fontSize + 15) {
                const max = Math.max(3, Math.floor((w - 20) / (fontSize * .58))), fill = ink(colorFor(row.id, i));
                g.append(svgEl('text', { x: x + 10, y: y + fontSize + 8, fill, 'font-size': fontSize, 'font-family': 'system-ui' }, row.name.length > max ? row.name.slice(0, max - 1) + '…' : row.name));
                if (h > fontSize * 2 + 22)
                    g.append(svgEl('text', { x: x + 10, y: y + fontSize * 2 + 16, fill, 'font-size': fontSize + 6, 'font-weight': 600, 'font-family': 'system-ui' }, integer.format(row.count)));
            }
            const activate = () => row.id && onClick?.(row);
            g.onclick = activate;
            g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
            } };
            svg.append(g);
            return;
        }
        const total = items.reduce((n, r) => n + r.count, 0);
        let sum = 0, index = 0;
        while (index < items.length - 1 && sum < total / 2)
            sum += items[index++].count;
        const part = total ? sum / total : .5;
        if (w > h) {
            divide(items.slice(0, index), x, y, w * part, h);
            divide(items.slice(index), x + w * part, y, w * (1 - part), h);
        }
        else {
            divide(items.slice(0, index), x, y, w, h * part);
            divide(items.slice(index), x, y + h * part, w, h * (1 - part));
        }
    }
    divide(rows, 0, 0, W, H);
    p.body.append(svg);
    exportControl(p);
    accessible(p, allRows, onClick);
}
export function network(p, data, onClick) {
    const nodes = data.nodes.slice(0, 40), ids = new Set(nodes.map(n => n.id)), edges = data.edges.filter(e => ids.has(e.source) && ids.has(e.target)).slice(0, 150);
    if (!nodes.length || !edges.length) {
        empty(p, 'Belum ada hubungan dalam subset ini. Diagram memerlukan sedikitnya dua simpul yang terhubung.');
        return;
    }
    p.body.classList.add('tall');
    const svg = svgEl('svg', { viewBox: '0 0 800 350', role: 'img', 'aria-label': p.title, xmlns: NS });
    const positions = new Map(nodes.map((n, i) => { const center = n.id === 'I55892964', angle = i / nodes.length * Math.PI * 2; return [n.id, { x: center ? 400 : 400 + Math.cos(angle) * 285, y: center ? 175 : 175 + Math.sin(angle) * 130 }]; }));
    const max = Math.max(...edges.map(e => e.count));
    for (const e of edges) {
        const a = positions.get(e.source), b = positions.get(e.target);
        const l = svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#85a594', 'stroke-opacity': .23 + e.count / max * .45, 'stroke-width': Math.min(6, 1 + Math.sqrt(e.count) / 4) });
        l.append(svgEl('title', {}, `${e.count} hubungan teramati`));
        svg.append(l);
    }
    nodes.forEach((n, i) => {
        const pos = positions.get(n.id), g = svgEl('g', { class: 'network-node', tabindex: 0, role: 'button', 'aria-label': `${n.name}: ${n.count}` });
        g.append(svgEl('circle', { cx: pos.x, cy: pos.y, r: Math.min(21, 5 + Math.sqrt(n.count || 1) / 3), fill: n.id === 'I55892964' ? '#183d34' : colorFor(n.id, i), stroke: '#fff', 'stroke-width': 2 }));
        g.append(svgEl('title', {}, `${n.name} · ${integer.format(n.count || 0)}`));
        if (i < 12)
            g.append(svgEl('text', { x: pos.x, y: pos.y + 29, 'text-anchor': 'middle', 'font-size': 9, fill: '#25332d', 'font-family': 'system-ui' }, n.name.length > 28 ? n.name.slice(0, 26) + '…' : n.name));
        g.onclick = () => onClick?.(n);
        g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.(n);
        } };
        svg.append(g);
    });
    p.body.append(svg);
    exportControl(p);
    accessible(p, nodes.map(n => ({ ...n, count: n.count || 0 })), onClick);
}
// Colours used by the citation and funding maps (Unand theme): text, primary bar colour and a two-colour blend.
const CHART = { primary: '#183D34', text: '#25332d' };
const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
// Citation map in the manner of VOSviewer (layout and clusters from sciencemap.js). Views: network (colour = cluster),
// overlay (colour = publication year) and density (blurred weight). Wheel or pinch zooms, dragging pans, hover shows neighbours.
const OTHER_CLUSTER = '#ADB5AD';
// Clusters need hues that stay apart; the first colour is Unand green, the rest are clearly different hues.
const clusterColor = c => [PALETTE[0], '#3080FF', '#E8A317', '#8200DA', '#D9480F', '#C2255C', '#0B7285', '#5C7CFA', '#874B00', '#6B7280'][(c - 1) % 10];
export function scienceMap(p, map, { view = 'network', onClick, files } = {}) {
    p.body.replaceChildren();
    if (!map.nodes.length) { empty(p, 'Tidak ada hubungan pada pilihan ini. Turunkan batas minimal atau pilih jenis hubungan lain.'); return; }
    p.body.classList.add('science-map');
    const W = 800, H = 460, pad = 40, xs = map.nodes.map(n => n.x), ys = map.nodes.map(n => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const scale = Math.min((W - 2 * pad) / ((x1 - x0) || 1), (H - 2 * pad) / ((y1 - y0) || 1));
    const pos = new Map(map.nodes.map(n => [n.id, [pad + (n.x - x0) * scale + ((W - 2 * pad) - (x1 - x0) * scale) / 2, pad + (n.y - y0) * scale + ((H - 2 * pad) - (y1 - y0) * scale) / 2]]));
    // The overlay scale runs from the 5th to the 95th percentile year, so a few old works do not wash out the recent ones.
    const years = map.nodes.map(n => n.year).filter(Boolean).sort((a, b) => a - b), [yMin, yMax] = [Math.floor(years[Math.floor(years.length * .05)]), Math.ceil(years[Math.ceil(years.length * .95) - 1])];
    const yearColor = y => y ? mix('#F3E6C4', '#183D34', yMax > yMin ? Math.min(1, Math.max(0, (y - yMin) / (yMax - yMin))) : 1) : OTHER_CLUSTER;
    const color = n => view === 'overlay' ? yearColor(n.year) : n.cluster ? clusterColor(n.cluster) : OTHER_CLUSTER;
    // Node size: citations for works, co-authored works for institutions (node.weight).
    const coauthor = map.kind === 'coauthorship', maxWeight = Math.max(1, ...map.nodes.map(n => n.weight)), radius = n => 3 + 11 * Math.sqrt(n.weight / maxWeight);
    const describe = n => coauthor ? `${n.label}: ${integer.format(n.works)} karya bersama, ${n.links} mitra, klaster ${n.cluster || 'lainnya'}` : `${n.label}, ${n.title}: ${integer.format(n.citations)} sitasi, klaster ${n.cluster || 'lainnya'}`;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': p.title, xmlns: NS, class: 'science-map-svg' });
    const stage = svgEl('g'), edgeLayer = svgEl('g'), nodeLayer = svgEl('g'), labelLayer = svgEl('g', { 'pointer-events': 'none' });
    if (view === 'density') {
        const defs = svgEl('defs'), blur = svgEl('filter', { id: 'map-density-blur', x: '-50%', y: '-50%', width: '200%', height: '200%' });
        blur.append(svgEl('feGaussianBlur', { stdDeviation: 14 })); defs.append(blur); svg.append(defs);
        const heat = svgEl('g', { filter: 'url(#map-density-blur)' });
        for (const n of map.nodes) { const [x, y] = pos.get(n.id); heat.append(svgEl('circle', { cx: x, cy: y, r: 10 + 26 * Math.sqrt(n.strength / Math.max(...map.nodes.map(m => m.strength))), fill: '#28745B', 'fill-opacity': .22 })); }
        stage.append(heat);
    } else {
        const maxA = Math.max(...map.edges.map(e => e.association));
        for (const e of map.edges) {
            const [ax, ay] = pos.get(e.source), [bx, by] = pos.get(e.target), src = map.nodes.find(n => n.id === e.source);
            const line = svgEl('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: color(src), 'stroke-opacity': .12 + .35 * e.association / maxA, 'stroke-width': .6 + 1.6 * e.association / maxA, 'data-a': e.source, 'data-b': e.target });
            edgeLayer.append(line);
        }
    }
    const neighbours = new Map(map.nodes.map(n => [n.id, new Set([n.id])]));
    for (const e of map.edges) { neighbours.get(e.source).add(e.target); neighbours.get(e.target).add(e.source); }
    const ranked = [...map.nodes].sort((a, b) => b.weight - a.weight), always = new Set(ranked.slice(0, coauthor ? 12 : 25).map(n => n.id));
    const labels = new Map();
    for (const n of map.nodes) {
        const [x, y] = pos.get(n.id), r = radius(n), g = svgEl('g', { class: 'network-node', tabindex: 0, role: 'button', 'aria-label': describe(n), 'data-id': n.id });
        g.append(svgEl('circle', { cx: x, cy: y, r, fill: view === 'density' ? 'transparent' : color(n), stroke: view === 'density' ? 'none' : '#fff', 'stroke-width': 1 }));
        g.append(svgEl('title', {}, coauthor ? `${n.label}${n.country ? ` (${n.country})` : ''}\n${integer.format(n.works)} karya bersama · ${n.links} mitra · klaster ${n.cluster || 'lainnya'}` : `${n.label} · ${n.title}\n${integer.format(n.citations)} sitasi · ${n.links} hubungan · klaster ${n.cluster || 'lainnya'}`));
        g.onclick = () => onClick?.(n);
        g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(n); } };
        g.onmouseenter = g.onfocus = () => focus(n.id); g.onmouseleave = g.onblur = () => focus(null);
        nodeLayer.append(g);
        const t = svgEl('text', { x, y: y + r + 9, 'text-anchor': 'middle', 'font-size': 9, fill: CHART.text, 'font-family': 'system-ui', 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 2.5 }, n.label.length > 34 ? n.label.slice(0, 32) + '…' : n.label);
        labels.set(n.id, t); labelLayer.append(t);
    }
    stage.append(edgeLayer, nodeLayer, labelLayer); svg.append(stage);
    let k = 1, tx = 0, ty = 0;
    const apply = () => {
        stage.setAttribute('transform', `translate(${tx} ${ty}) scale(${k})`);
        for (const [id, t] of labels) { t.setAttribute('font-size', 9 / k); t.setAttribute('stroke-width', 2.5 / k); t.style.display = always.has(id) || radius(map.nodes.find(n => n.id === id)) * k > 9 ? '' : 'none'; }
    };
    function focus(id) {
        const keep = id ? neighbours.get(id) : null;
        for (const g of nodeLayer.children) g.style.opacity = !keep || keep.has(g.dataset.id) ? 1 : .15;
        for (const l of edgeLayer.children) l.style.opacity = !keep || l.dataset.a === id || l.dataset.b === id ? '' : .05;
        for (const [nid, t] of labels) t.style.visibility = !keep || keep.has(nid) ? '' : 'hidden';
        if (id) labels.get(id).style.display = ''; else apply();
    }
    const point = e => { const b = svg.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
    const zoomAt = (factor, [px, py]) => { const nk = Math.min(12, Math.max(.6, k * factor)); tx = px - (px - tx) * nk / k; ty = py - (py - ty) * nk / k; k = nk; apply(); };
    svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * .0015), point(e)); }, { passive: false });
    const pointers = new Map(); let last = null, pinch = null;
    svg.addEventListener('pointerdown', e => { if (e.target.closest('.network-node')) return; svg.setPointerCapture(e.pointerId); pointers.set(e.pointerId, point(e)); last = point(e); });
    svg.addEventListener('pointermove', e => {
        if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, point(e));
        if (pointers.size === 2) { const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoomAt(d / pinch, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); pinch = d; return; }
        const now = point(e); tx += now[0] - last[0]; ty += now[1] - last[1]; last = now; apply();
    });
    const release = e => { pointers.delete(e.pointerId); pinch = null; last = pointers.size ? [...pointers.values()][0] : null; };
    svg.addEventListener('pointerup', release); svg.addEventListener('pointercancel', release);
    const tools = el('div', { class: 'map-tools' });
    for (const [label, aria, fn] of [['+', 'Perbesar', () => zoomAt(1.4, [W / 2, H / 2])], ['−', 'Perkecil', () => zoomAt(1 / 1.4, [W / 2, H / 2])], ['Reset', 'Kembalikan tampilan', () => { k = 1; tx = ty = 0; apply(); }]]) {
        const b = el('button', { type: 'button', class: 'map-tool', 'aria-label': aria }, label); b.onclick = fn; tools.append(b);
    }
    p.body.append(tools, svg);
    apply();
    const legend = el('div', { class: 'map-legend' });
    if (view === 'overlay') legend.append(el('span', { class: 'map-gradient' }), el('span', {}, `${yMin} atau sebelumnya → ${yMax} atau sesudahnya (${coauthor ? 'rata-rata tahun terbit karya bersama' : 'tahun terbit'})`));
    else for (const c of map.clusters) {
        const item = el('span', { class: 'map-legend-item' }), dot = el('i'); dot.style.background = c.id ? clusterColor(c.id) : OTHER_CLUSTER;
        item.append(dot, `${c.id ? `Klaster ${c.id}` : 'Lainnya'}: ${coauthor ? `${c.lead}${c.size > 1 ? ` dan ${c.size - 1} lainnya` : ''}${c.country_name ? ` · sebagian besar ${c.country_name}` : ''}` : `${c.topic_name || 'topik beragam'} (${c.size})`}`); legend.append(item);
    }
    p.body.append(legend);
    exportControl(p);
    if (files) { const b = el('button', { class: 'chart-export', type: 'button', 'aria-label': `Unduh berkas VOSviewer untuk ${p.title}` }, '↓ VOSviewer');
        b.onclick = () => { const prefix = coauthor ? 'vosviewer-institutions' : 'vosviewer'; downloadText(files.map, `${prefix}-map.txt`); setTimeout(() => downloadText(files.network, `${prefix}-network.txt`), 300); }; p.actions.append(b); }
    accessible(p, ranked.map(n => ({ ...n, name: n.label, count: n.weight, description: describe(n) })), onClick);
}
// Funding flows (funder → field or topic). Sankey: band width = works; heatmap: the same counts as a matrix.
// onClick receives { funder, target } (either may be null for a whole node).
export function fundingFlow(p, flow, { view = 'sankey', onClick } = {}) {
    p.body.replaceChildren();
    if (!flow.links.length) { empty(p, 'Tidak ada karya dengan pendana tercatat pada pilihan ini.'); return; }
    p.body.classList.add('funding-flow');
    const color = new Map(flow.sources.map((s, i) => [s.id, s.id === 'other' ? OTHER_CLUSTER : clusterColor(i + 1)]));
    const short = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
    const click = (funder, target) => onClick?.({ funder: funder === 'other' ? null : funder, target: target === 'other' ? null : target });
    if (view === 'heatmap') {
        const max = Math.max(...flow.links.map(l => l.count)), cell = new Map(flow.links.map(l => [`${l.source}|${l.target}`, l.count]));
        const wrap = el('div', { class: 'flow-matrix-wrap' }), table = el('table', { class: 'flow-matrix' }), head = el('tr');
        head.append(el('th', { scope: 'col' }, 'Pendana'));
        for (const t of flow.targets) head.append(el('th', { scope: 'col', title: t.name }, short(t.name, 22)));
        const body = el('tbody');
        for (const s of flow.sources) {
            const row = el('tr'); row.append(el('th', { scope: 'row', title: s.name }, short(s.name, 40)));
            for (const t of flow.targets) {
                const n = cell.get(`${s.id}|${t.id}`) || 0, td = el('td', { class: 'num' });
                if (n) { const b = el('button', { type: 'button', class: 'flow-cell', 'aria-label': `${s.name} dan ${t.name}: ${n} karya`, title: `${s.name} → ${t.name}: ${n} karya` }, String(n));
                    b.style.background = `color-mix(in srgb, var(--forest) ${Math.round(12 + 78 * n / max)}%, #fff)`; if (n / max > .5) b.style.color = '#fff'; b.onclick = () => click(s.id, t.id); td.append(b); }
                row.append(td);
            }
            body.append(row);
        }
        table.append(el('thead', {}), body); table.firstChild.append(head); wrap.append(table); p.body.append(wrap);
    } else {
        const W = 800, gap = 6, rows = Math.max(flow.sources.length, flow.targets.length), H = Math.max(320, rows * 30), x0 = 250, x1 = 550, bar = 12;
        const scale = (H - gap * (rows - 1)) / Math.max(flow.links.reduce((s, l) => s + l.count, 0), 1);
        const lay = (nodes, side) => { let y = 0; const totals = new Map(); for (const l of flow.links) totals.set(l[side], (totals.get(l[side]) || 0) + l.count);
            return new Map(nodes.map(n => { const h = Math.max(2, totals.get(n.id) * scale), pos = { y, h, used: 0 }; y += h + gap; return [n.id, pos]; })); };
        const L = lay(flow.sources, 'source'), R = lay(flow.targets, 'target');
        const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': p.title, xmlns: NS, class: 'flow-svg' }), bands = svgEl('g'), nodes = svgEl('g');
        const order = [...flow.links].sort((a, b) => flow.sources.findIndex(s => s.id === a.source) - flow.sources.findIndex(s => s.id === b.source) || flow.targets.findIndex(t => t.id === a.target) - flow.targets.findIndex(t => t.id === b.target));
        const rOrder = [...flow.links].sort((a, b) => flow.targets.findIndex(t => t.id === a.target) - flow.targets.findIndex(t => t.id === b.target) || flow.sources.findIndex(s => s.id === a.source) - flow.sources.findIndex(s => s.id === b.source));
        const rY = new Map(); for (const l of rOrder) { const r = R.get(l.target); rY.set(l, r.y + r.used); r.used += l.count * scale; }
        for (const l of order) {
            const a = L.get(l.source), h = l.count * scale, ya = a.y + a.used, yb = rY.get(l); a.used += h;
            const mid = (x0 + bar + x1) / 2, d = `M${x0 + bar},${ya}C${mid},${ya} ${mid},${yb} ${x1},${yb}L${x1},${yb + h}C${mid},${yb + h} ${mid},${ya + h} ${x0 + bar},${ya + h}Z`;
            const s = flow.sources.find(n => n.id === l.source), t = flow.targets.find(n => n.id === l.target);
            const path = svgEl('path', { d, fill: color.get(l.source), 'fill-opacity': .42, class: 'flow-band', tabindex: 0, role: 'button', 'aria-label': `${s.name} ke ${t.name}: ${l.count} karya`, 'data-s': l.source, 'data-t': l.target });
            path.append(svgEl('title', {}, `${s.name} → ${t.name}\n${integer.format(l.count)} karya`));
            path.onclick = () => click(l.source, l.target); path.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(l.source, l.target); } };
            bands.append(path);
        }
        const focus = (side, id) => { for (const b of bands.children) b.setAttribute('fill-opacity', !id || b.dataset[side] === id ? .55 : .08); };
        const node = (n, pos, x, side) => {
            const g = svgEl('g', { class: 'network-node', tabindex: 0, role: 'button', 'aria-label': `${n.name}: ${n.count} karya berpendana` });
            g.append(svgEl('rect', { x, y: pos.y, width: bar, height: pos.h, rx: 2, fill: side === 's' ? color.get(n.id) : CHART.primary }));
            const left = side === 's', label = svgEl('text', { x: left ? x - 8 : x + bar + 8, y: pos.y + pos.h / 2 + 3, 'text-anchor': left ? 'end' : 'start', 'font-size': 10, fill: CHART.text, 'font-family': 'system-ui' }, `${short(n.name, 34)} (${integer.format(n.count)})`);
            g.append(label, svgEl('title', {}, `${n.name}: ${integer.format(n.count)} karya berpendana`));
            g.onmouseenter = g.onfocus = () => focus(side, n.id); g.onmouseleave = g.onblur = () => focus(side, null);
            g.onclick = () => left ? click(n.id, null) : click(null, n.id);
            g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); g.onclick(); } };
            nodes.append(g);
        };
        flow.sources.forEach(n => node(n, L.get(n.id), x0, 's')); flow.targets.forEach(n => node(n, R.get(n.id), x1, 't'));
        svg.append(bands, nodes); p.body.append(svg);
        exportControl(p);
    }
    accessible(p, flow.links.map(l => ({ name: `${flow.sources.find(s => s.id === l.source).name} → ${flow.targets.find(t => t.id === l.target).name}`, count: l.count, funder: l.source, target: l.target })), r => click(r.funder, r.target));
}
