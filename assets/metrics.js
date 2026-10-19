/* Pure metric functions shared by the browser worker and snapshot builder. */
export const MODULES = [
    ['overview', 'Ringkasan', '01'], ['publications', 'Publikasi', '02'],
    ['authors', 'Penulis', '03'], ['citations', 'Dampak sitasi', '04'],
    ['collaboration', 'Kolaborasi', '05'], ['topics', 'Bidang & topik', '06'],
    ['sdgs', 'SDGs', '07'], ['oa', 'Open access', '08'],
    ['funding', 'Pendanaan', '09'], ['journals', 'Jurnal Unand', '10'],
    ['repositories', 'Repositori', '11'], ['audit', 'Audit & metodologi', '12'],
];
export const SDGS = ['Tanpa kemiskinan', 'Tanpa kelaparan', 'Kehidupan sehat', 'Pendidikan berkualitas',
    'Kesetaraan gender', 'Air bersih & sanitasi', 'Energi bersih', 'Pekerjaan & pertumbuhan ekonomi',
    'Industri & inovasi', 'Berkurangnya kesenjangan', 'Kota berkelanjutan', 'Konsumsi bertanggung jawab',
    'Penanganan perubahan iklim', 'Ekosistem lautan', 'Ekosistem daratan', 'Perdamaian & kelembagaan', 'Kemitraan'];
export const BINS = [[0, 0, '0 sitasi'], [1, 5, '1–5'], [6, 10, '6–10'], [11, 50, '11–50'], [51, 100, '51–100'], [101, Infinity, '>100']];
export const validNumber = value => typeof value === 'number' && Number.isFinite(value);
export const percentage = (a, b) => b ? a / b * 100 : null;
export function csvCell(value) {
    let text = String(value ?? '');
    if (/^\s*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
}
export function historyWeek(value) {
    const date = new Date(value.slice(0, 10) + 'T00:00:00Z');
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const year = date.getUTCFullYear(), start = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((date - start) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
}
export function median(values) {
    if (!values.length)
        return null;
    const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function hIndex(values) {
    const sorted = [...values].sort((a, b) => b - a);
    return sorted.reduce((h, value, index) => value >= index + 1 ? index + 1 : h, 0);
}
export const institutionIDs = work => [...new Set(work.authors.flatMap(a => a.institutions))];
export function auditFlags(work, year) {
    return {
        doi: !work.doi, abstract: !work.abstract, source: !work.source,
        field: !work.field, funder: !work.funders.length,
        affiliation: work.unmatched_affiliation || !work.authors.some(a => a.institutions.length) || work.scopes.includes('affiliated') && !work.authors.some(a=>a.unand),
        author_id: work.authors.some(a=>!a.id),
        date: !validNumber(work.year) || work.year < 1900 || work.year > year,
        retracted: work.retracted,
    };
}
export function matches(work, filter, entities, year = new Date().getFullYear()) {
    const scopes = work.scopes || [];
    if (!scopes.includes(filter.scope || 'affiliated'))
        return false;
    if ((filter.corpus || 'core') === 'core' && work.xpac)
        return false;
    if (filter.dateQuality === 'valid' && growthExclusion(work, year))
        return false;
    if (filter.fwciQuality === 'valid' && (growthExclusion(work, year) || !validNumber(work.fwci) || work.fwci < 0))
        return false;
    if (filter.from && (!validNumber(work.year) || work.year < Number(filter.from)))
        return false;
    if (filter.to && (!validNumber(work.year) || work.year > Number(filter.to)))
        return false;
    if (filter.type && work.type !== filter.type)
        return false;
    if (filter.language && work.language !== filter.language)
        return false;
    if (filter.license && !work.locations.some(l => (l.license || 'unknown') === filter.license))
        return false;
    if ((filter.version || filter.locationType) && !work.locations.some(l => (!filter.version || (l.version || 'unknown') === filter.version) && (!filter.locationType || (entities.sources[l.source]?.type || 'unknown') === filter.locationType)))
        return false;
    if (filter.field && (work.field || 'unknown') !== filter.field)
        return false;
    if (filter.topic && !(work.topics?.length ? work.topics : [work.topic || 'unknown']).includes(filter.topic))
        return false;
    if (filter.oa && (filter.oa === 'open' ? !work.oa : filter.oa === 'closed' ? work.oa : work.oa_status !== filter.oa))
        return false;
    if (filter.author && !work.authors.some(a => a.id === filter.author && (filter.scope !== 'affiliated' || a.unand)))
        return false;
    if (filter.partner && !institutionIDs(work).includes(filter.partner))
        return false;
    if (filter.country && !work.countries.includes(filter.country))
        return false;
    if (filter.funder && !work.funders.includes(filter.funder))
        return false;
    if (filter.award && !work.awards.includes(filter.award))
        return false;
    if (filter.local === 'yes' && !work.authors.some(a => a.unand))
        return false;
    if (filter.local === 'no' && work.authors.some(a => a.unand))
        return false;
    if (filter.source && (work.source || 'unknown') !== filter.source)
        return false;
    if (filter.sdg && !work.sdgs.includes(String(filter.sdg)))
        return false;
    if (filter.design && !work.designs.includes(filter.design))
        return false;
    if (filter.bin !== undefined && filter.bin !== '') {
        const bin = BINS[Number(filter.bin)];
        if (!bin || work.citations < bin[0] || work.citations > bin[1])
            return false;
    }
    if (filter.audit && !auditFlags(work, year)[filter.audit])
        return false;
    if (filter.metric === 'oa' && !work.oa)
        return false;
    if (filter.metric === 'international' && (work.country_count ?? work.countries.length) < 2)
        return false;
    if (filter.metric === 'fwci' && !validNumber(work.fwci))
        return false;
    if (['top10', 'top1'].includes(filter.metric) && (!validNumber(work.percentile?.value) || typeof work.percentile?.is_in_top_10_percent !== 'boolean' || work.percentile[filter.metric === 'top10' ? 'is_in_top_10_percent' : 'is_in_top_1_percent'] !== true))
        return false;
    if (filter.q) {
        const names = work.authors.map(a => entities.authors[a.id]?.name || a.name || a.id);
        const text = [work.title, work.doi, work.id, ...names].join(' ').toLocaleLowerCase('id');
        if (!text.includes(filter.q.toLocaleLowerCase('id')))
            return false;
    }
    return true;
}
export function filteredWorks(works, filter, entities, year) {
    return works.filter(work => matches(work, filter, entities, year));
}
export function annualFWCI(yearRows, from, to) {
    const byYear = new Map(yearRows.map(row => [Number(row.id), row]));
    const available = [...byYear.keys()].filter(Number.isInteger);
    const first = Number(from) || Math.min(...available), last = Number(to) || Math.max(...available);
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1500 || last > 2100 || first > last) return [];
    return Array.from({ length: last - first + 1 }, (_, i) => {
        const year = first + i, row = byYear.get(year);
        const count = row?.count || 0, eligible = row?.fwci_n || 0;
        return { id: String(year), year, count, fwci_n: eligible,
            fwci: eligible ? row.fwci_sum / eligible : null, coverage: percentage(eligible, count) };
    });
}
export function publicationGrowth(yearRows, from, to, currentYear) {
    const rows = annualFWCI(yearRows, from, to);
    return rows.map((row, i) => {
        const previous = i ? rows[i - 1].count : null;
        const incomplete = row.year >= currentYear;
        return { id: row.id, year: row.year, count: row.count, previous,
            change: previous === null ? null : row.count - previous,
            growth: !incomplete && previous > 0 ? (row.count - previous) / previous * 100 : null,
            incomplete };
    });
}
export const GROWTH_POLICY = Object.freeze({ version: 1, first_year: 1956, min_previous: 30,
    excluded_dates: Object.freeze(['1969-12-31', '1970-01-01']),
    year_source: 'https://www.unand.ac.id/2023/613-unand-dies-natalis-inovasi' });
export function growthExclusion(work, currentYear) {
    if (!Number.isInteger(work.year)) return 'invalid_year';
    if (work.year < GROWTH_POLICY.first_year) return 'before_institution';
    if (work.year > currentYear) return 'future_year';
    if (GROWTH_POLICY.excluded_dates.includes(work.date)) return 'epoch_date';
    return '';
}
export function normalizedPublicationGrowth(works, yearRows, filter, currentYear) {
    const excluded = { invalid_year: 0, before_institution: 0, future_year: 0, epoch_date: 0 }, counts = new Map();
    for (const work of works) {
        const reason = growthExclusion(work, currentYear);
        if (reason) { excluded[reason]++; continue; }
        counts.set(work.year, (counts.get(work.year) || 0) + 1);
    }
    const raw = publicationGrowth(yearRows, filter.from, filter.to, currentYear);
    const rawByYear = new Map(raw.map(row => [row.year, row]));
    const first = filter.from ? Math.max(GROWTH_POLICY.first_year, Number(filter.from)) : '';
    const last = filter.to ? Math.min(currentYear, Number(filter.to)) : '';
    const cleaned = [...counts].map(([year, count]) => ({ id: String(year), count }));
    const rows = publicationGrowth(cleaned, first, last, currentYear).map(row => {
        const status = row.incomplete ? 'incomplete' : row.previous === null ? 'no_comparison'
            : row.previous === 0 ? 'zero_base' : row.previous < GROWTH_POLICY.min_previous ? 'small_base' : 'valid';
        return { ...row, growth: status === 'valid' ? row.growth : null, status,
            raw_count: rawByYear.get(row.year)?.count || 0, raw_growth: rawByYear.get(row.year)?.growth ?? null };
    });
    const excludedCount = Object.values(excluded).reduce((sum, count) => sum + count, 0);
    return { rows, normalization: { policy: GROWTH_POLICY, excluded, excluded_count: excludedCount,
        input_count: works.length, retained_count: works.length - excludedCount,
        small_base_years: rows.filter(row => row.status === 'small_base').length, raw_rows: raw } };
}
export const FWCI_POLICY = Object.freeze({ version: 1, min_works: 30, date_policy_version: GROWTH_POLICY.version,
    benchmark: 1, source: 'https://help.openalex.org/data/works/citations/' });
export function normalizedAnnualFWCI(works, yearRows, filter, currentYear) {
    const excluded = { invalid_year: 0, before_institution: 0, future_year: 0, epoch_date: 0 }, byYear = new Map();
    let missing = 0, invalid = 0;
    for (const work of works) {
        const reason = growthExclusion(work, currentYear);
        if (reason) { excluded[reason]++; continue; }
        if (!byYear.has(work.year)) byYear.set(work.year, { id: String(work.year), count: 0, fwci_n: 0, fwci_sum: 0 });
        const row = byYear.get(work.year);
        row.count++;
        if (validNumber(work.fwci) && work.fwci >= 0) { row.fwci_n++; row.fwci_sum += work.fwci; }
        else if (work.fwci === null || work.fwci === undefined) missing++;
        else invalid++;
    }
    const first = filter.from ? Math.max(GROWTH_POLICY.first_year, Number(filter.from)) : '';
    const last = filter.to ? Math.min(currentYear, Number(filter.to)) : '';
    const rows = annualFWCI([...byYear.values()], first, last).map(row => ({ ...row,
        observed_fwci: row.fwci, fwci: row.fwci_n >= FWCI_POLICY.min_works ? row.fwci : null,
        status: !row.fwci_n ? 'no_metric' : row.fwci_n < FWCI_POLICY.min_works ? 'small_sample' : 'valid' }));
    const excludedCount = Object.values(excluded).reduce((sum, count) => sum + count, 0);
    return { rows, normalization: { policy: FWCI_POLICY, date_policy: GROWTH_POLICY, excluded, excluded_count: excludedCount,
        input_count: works.length, retained_count: works.length - excludedCount, missing_fwci_count: missing, invalid_fwci_count: invalid,
        small_sample_years: rows.filter(row => row.status === 'small_sample').length,
        raw_rows: annualFWCI(yearRows, filter.from, filter.to) } };
}
export function entityPage(works, entities, filter, manifest, options = {}) {
    if (!['authors', 'partners', 'funders', 'sources'].includes(options.kind))
        throw new Error('Jenis tabel tidak dikenali.');
    return summarize(works, entities, filter, manifest, [], options);
}
export function summarize(works, entities, filter, manifest, history = [], tableOptions = null) {
    const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(new Date(manifest.updated_at)));
    const selected = filteredWorks(works, filter, entities, currentYear);
    const fields = new Map();
    for (const t of Object.values(entities.topics))
        if (t.field)
            fields.set(t.field, t.field_name || t.field);
    const name = (type, id) => {
        if (type === 'field')
            return fields.get(id) || id || 'Tidak diketahui';
        if (type === 'country')
            return entities.countries[id] || id;
        if (type === 'sdg')
            return `SDG ${id} · ${SDGS[Number(id) - 1] || id}`;
        return entities[type]?.[id]?.name || id || 'Tidak diketahui';
    };
    const maps = Object.fromEntries(['years', 'types', 'languages', 'fields', 'topics', 'countries', 'partners',
        'sources', 'sdgs', 'funders', 'designs', 'oa', 'authors', 'sectors', 'licenses', 'versions', 'awards'].map(k => [k, new Map()]));
    function add(kind, id, label, work) {
        id = String(id || 'unknown');
        let row = maps[kind].get(id);
        if (!row) {
            row = { id, name: String(label || id), count: 0, citations: 0, oa: 0, years: {}, fwci_sum: 0, fwci_n: 0 };
            maps[kind].set(id, row);
        }
        row.count++;
        row.citations += work.citations;
        row.oa += work.oa ? 1 : 0;
        if (validNumber(work.year))
            row.years[work.year] = (row.years[work.year] || 0) + 1;
        if (validNumber(work.fwci)) {
            row.fwci_sum += work.fwci;
            row.fwci_n++;
        }
        return row;
    }
    const quality = Object.fromEntries(['doi', 'abstract', 'source', 'field', 'funder', 'affiliation', 'author_id', 'date', 'retracted'].map(k => [k, 0]));
    const qualityYears = Object.fromEntries(Object.keys(quality).map(k => [k, {}]));
    const versionLocations = new Map();
    const coverage = { abstract: 0, pdf: 0, xml: 0, repo: 0, any_repo: 0, license: 0, orcid_authors: 0 };
    const citationYears = new Map(), oaYears = new Map(), sdgFields = new Map(), oaFields = new Map();
    let citations = 0, oa = 0, international = 0, fwciSum = 0, fwciN = 0, eligible = 0, top10 = 0, top1 = 0, cited = 0;
    let first = 0, corresponding = 0, apcSum = 0, apcN = 0, paidVerified = 0, paidFallback = 0;
    const localRepo = new Set(manifest.institution.repositories || []);
    const localCountries = new Set(), affiliatedAuthors = new Set();
    for (const work of selected) {
        citations += work.citations;
        oa += work.oa ? 1 : 0;
        cited += work.citations > 0 ? 1 : 0;
        const intl = (work.country_count ?? work.countries.length) > 1;
        international += intl ? 1 : 0;
        if (validNumber(work.fwci)) {
            fwciSum += work.fwci;
            fwciN++;
        }
        if (validNumber(work.percentile?.value) && typeof work.percentile?.is_in_top_10_percent === 'boolean') {
            eligible++;
            top10 += work.percentile.is_in_top_10_percent ? 1 : 0;
            top1 += work.percentile.is_in_top_1_percent ? 1 : 0;
        }
        const flags = auditFlags(work, currentYear);
        for (const [key, val] of Object.entries(flags))
            if (val) {
                quality[key]++;
                qualityYears[key][work.year] = (qualityYears[key][work.year] || 0) + 1;
            }
        coverage.abstract += work.abstract ? 1 : 0;
        coverage.pdf += work.content.pdf === true ? 1 : 0;
        coverage.xml += work.content.grobid_xml === true ? 1 : 0;
        coverage.repo += work.locations.some(l => localRepo.has(l.source)) ? 1 : 0;
        coverage.any_repo += work.repository_copy ? 1 : 0;
        coverage.license += work.locations.some(l => !!l.license) ? 1 : 0;
        let hasFirst = work.authors.some(a=>a.unand&&a.position==='first'), hasCorresponding = work.authors.some(a=>a.unand&&a.corresponding);
        for (const a of [...new Map(work.authors.filter(a => a.unand&&a.id).map(a => [a.id, a])).values()]) {
            affiliatedAuthors.add(a.id);
            const row = add('authors', a.id, name('authors', a.id), work);
            const isFirst = work.authors.some(item => item.id === a.id && item.unand && item.position === 'first');
            const isCorresponding = work.authors.some(item => item.id === a.id && item.unand && item.corresponding);
            row.first = (row.first || 0) + (isFirst ? 1 : 0);
            row.corresponding = (row.corresponding || 0) + (isCorresponding ? 1 : 0);
            row.orcid = !!entities.authors[a.id]?.orcid;
            row.career_works = entities.authors[a.id]?.career_works ?? null;
            row.career_citations = entities.authors[a.id]?.career_citations ?? null;
            hasFirst ||= isFirst;
            hasCorresponding ||= isCorresponding;
        }
        first += hasFirst ? 1 : 0;
        corresponding += hasCorresponding ? 1 : 0;
        add('years', work.year || 'unknown', work.year || 'Tidak diketahui', work);
        add('types', work.type, work.type, work);
        add('languages', work.language, work.language, work);
        add('fields', work.field, name('field', work.field), work);
        for (const topic of new Set(work.topics?.length ? work.topics : [work.topic || 'unknown'])) add('topics', topic, name('topics',topic),work);
        add('oa', work.oa_status, work.oa_status, work);
        const sourceRow = add('sources', work.source, name('sources', work.source), work);
        sourceRow.local = (sourceRow.local || 0) + (work.authors.some(a => a.unand) ? 1 : 0);
        sourceRow.metadata = entities.sources[work.source] || null;
        for (const id of new Set(work.countries)) {
            localCountries.add(id);
            add('countries', id, name('country', id), work);
        }
        const sectors = new Set();
        for (const id of institutionIDs(work)) {
            if (entities.institutions[id]?.unand)
                continue;
            add('partners', id, name('institutions', id), work).metadata = entities.institutions[id] || null;
            sectors.add(entities.institutions[id]?.type || 'unknown');
        }
        for (const sector of sectors)
            add('sectors', sector, sector, work);
        for (const id of new Set(work.sdgs)) {
            add('sdgs', id, name('sdg', id), work);
            const key = `${id}|${work.field || 'unknown'}`;
            sdgFields.set(key, (sdgFields.get(key) || 0) + 1);
        }
        for (const id of new Set(work.funders))
            add('funders', id, name('funders', id), work);
        for (const id of new Set(work.awards))
            add('awards', id, name('awards', id), work);
        for (const id of new Set(work.designs))
            add('designs', id, id.replaceAll('-', ' '), work);
        for (const license of new Set(work.locations.map(l => l.license || 'unknown')))
            add('licenses', license, license, work);
        for (const version of new Set(work.locations.map(l => l.version || 'unknown')))
            add('versions', version, version, work);
        for (const pair of new Set(work.locations.map(l => `${l.version || 'unknown'}|${entities.sources[l.source]?.type || 'unknown'}`)))
            versionLocations.set(pair, (versionLocations.get(pair) || 0) + 1);
        const year = work.year || 'unknown';
        if (!oaYears.has(year))
            oaYears.set(year, { year, total: 0, international: 0, oa: {} });
        const oy = oaYears.get(year);
        oy.total++;
        oy.international += intl ? 1 : 0;
        oy.oa[work.oa_status] = (oy.oa[work.oa_status] || 0) + 1;
        for (const [year, value] of work.citation_years)
            citationYears.set(year, (citationYears.get(year) || 0) + value);
        const of = `${work.field || 'unknown'}|${work.oa_status}`;
        oaFields.set(of, (oaFields.get(of) || 0) + 1);
        if (validNumber(work.apc_list?.value_usd)) {
            apcSum += work.apc_list.value_usd;
            apcN++;
        }
        if (work.apc_paid)
            work.apc_paid.provenance === 'openapc' ? paidVerified++ : paidFallback++;
    }
    coverage.orcid_authors = [...affiliatedAuthors].filter(id => entities.authors[id]?.orcid).length;
    const sorted = kind => [...maps[kind].values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    if (tableOptions) {
        const all = sorted(tableOptions.kind), limit = tableOptions.kind === 'authors' ? 500 : null;
        const ranked = (limit ? all.slice(0, limit) : all).map((row, i) => ({ ...row, rank: i + 1 }));
        const search = String(tableOptions.search || '').trim().toLocaleLowerCase('id-ID');
        const rows = search ? ranked.filter(row => `${row.name} ${row.id}`.toLocaleLowerCase('id-ID').includes(search)) : ranked;
        const pageSize = 50, page = Math.max(0, Math.min(Math.floor(Number(tableOptions.page) || 0), Math.max(0, Math.ceil(rows.length / pageSize) - 1)));
        return { rows: rows.slice(page * pageSize, (page + 1) * pageSize), total: rows.length,
            eligible: all.length, limit, page, page_size: pageSize };
    }
    const top = Object.fromEntries(Object.keys(maps).map(k => [k, sorted(k).slice(0, k === 'sdgs' ? 17 : 50)]));
    top.journals = sorted('sources').filter(row => row.metadata?.type === 'journal').slice(0, 10);
    top.years = [...maps.years.values()].sort((a, b) => Number(a.id) - Number(b.id));
    const completeYear = Math.min(Number(filter.to) || currentYear - 1, currentYear - 1);
    const last = maps.years.get(String(completeYear))?.count || 0, prior = maps.years.get(String(completeYear - 1))?.count || 0;
    const publicationRows = [...selected].sort((a, b) => b.citations - a.citations || String(b.date).localeCompare(String(a.date))).slice(0, 50).map(w => ({
        id: w.id, title: w.title, doi: w.doi, year: w.year, citations: w.citations, oa_status: w.oa_status,
        source_name: name('sources', w.source), scope: w.scopes, retracted: w.retracted,
    }));
    const histogram = BINS.map(([min, max, label], index) => ({ id: String(index), name: label, count: selected.filter(w => w.citations >= min && w.citations <= max).length }));
    const networks = makeNetworks(selected, entities, top.partners, top.funders);
    const fieldNames = Object.fromEntries(fields);
    const topicCandidates = filter.topic ? filteredWorks(works, { ...filter, topic: '' }, entities, currentYear) : selected;
    const allTopics = [...new Map(topicCandidates.flatMap(w=>(w.topics?.length?w.topics:[w.topic]).filter(Boolean).map(id=>[id,{id,name:name('topics',id),field:entities.topics[id]?.field,subfield:entities.topics[id]?.subfield}]))).values()];
    const growth = normalizedPublicationGrowth(selected, top.years, filter, currentYear);
    const fwci = normalizedAnnualFWCI(selected, top.years, filter, currentYear);
    return { filter, total: selected.length, kpis: { publications: selected.length, citations, oa: percentage(oa, selected.length),
            international: percentage(international, selected.length), fwci: fwciN ? fwciSum / fwciN : null,
            fwci_n: fwciN, fwci_coverage: percentage(fwciN, selected.length), top10, top1, eligible,
            top10_share: percentage(top10, eligible), percentile_coverage: percentage(eligible, selected.length),
            cited_share: percentage(cited, selected.length), median_citations: median(selected.map(w => w.citations)),
            h_index: hIndex(selected.map(w => w.citations)), authors: affiliatedAuthors.size,
            partners: maps.partners.size, countries: localCountries.size, growth: prior ? (last - prior) / prior * 100 : null,
            field_concentration: selected.length ? [...maps.fields.values()].reduce((n, r) => n + (r.count / selected.length) ** 2, 0) : null,
            top3_fields_share: percentage(sorted('fields').slice(0, 3).reduce((n, r) => n + r.count, 0), selected.length),
            growth_year: completeYear, first, corresponding, apc_mean: apcN ? apcSum / apcN : null, apc_n: apcN, paid_verified: paidVerified, paid_fallback: paidFallback },
        top, annual_fwci: annualFWCI(top.years, filter.from, filter.to),
        publication_growth: growth.rows, growth_normalization: growth.normalization, histogram, quality, quality_years: qualityYears, coverage,
        fwci_timeline: fwci.rows, fwci_normalization: fwci.normalization,
        country_map: sorted('countries').map(({ id, name, count, citations }) => ({ id, name, count, citations })),
        version_locations: [...versionLocations].map(([key, count]) => { const [version, type] = key.split('|'); return { version, type, count }; }),
        citation_years: [...citationYears].sort((a, b) => a[0] - b[0]),
        oa_years: [...oaYears.values()].sort((a, b) => a.year - b.year),
        sdg_fields: [...sdgFields].map(([key, count]) => { const [sdg, field] = key.split('|'); return { sdg, field, name: fieldNames[field] || field, count }; }),
        oa_fields: [...oaFields].map(([key, count]) => { const [field, oa] = key.split('|'); return { field, oa, name: fieldNames[field] || field, count }; }),
        scatter: [...selected].sort((a, b) => b.citations - a.citations).slice(0, 250).map(w => ({ id: w.id, title: w.title, age: currentYear - (w.year || currentYear), citations: w.citations, fwci: w.fwci })),
        publications: publicationRows, networks,
        facets: { fields: [...fields].map(([id, name]) => ({ id, name })), topics: allTopics,
            types: sorted('types').map(({ id, name }) => ({ id, name })) },
        history: history.slice(-12), current_year: currentYear,
        audit_candidates: works.filter(w => w.scopes.includes('audit') && !w.scopes.includes('affiliated') &&
            (!filter.from || w.year >= Number(filter.from)) && (!filter.to || w.year <= Number(filter.to)) &&
            (filter.corpus !== 'core' || !w.xpac)).slice(0, 50).map(w => ({ id: w.id, title: w.title, year: w.year, doi: w.doi })),
    };
}
function makeNetworks(works, entities, partnerRows, funderRows) {
    const partnerIDs = new Set(partnerRows.slice(0, 25).map(r => r.id)), partnerEdges = new Map();
    const funderIDs = new Set(funderRows.slice(0, 15).map(r => r.id)), fundingEdges = new Map(), centerCounts = new Map();
    const addEdge = (map, a, b) => { const key = [a, b].sort().join('|'); map.set(key, (map.get(key) || 0) + 1); };
    for (const w of works) {
        const ids = institutionIDs(w).filter(id => partnerIDs.has(id));
        if (w.authors.some(a => a.unand))
            for (const id of ids)
                centerCounts.set(id, (centerCounts.get(id) || 0) + 1);
        for (let i = 0; i < ids.length; i++)
            for (let j = i + 1; j < ids.length; j++)
                addEdge(partnerEdges, ids[i], ids[j]);
        for (const f of new Set(w.funders.filter(id => funderIDs.has(id))))
            if (w.topic)
                addEdge(fundingEdges, f, w.topic);
    }
    const nodes = partnerRows.slice(0, 25).map(r => ({ id: r.id, name: r.name, count: r.count }));
    const edgeList = map => [...map].sort((a, b) => b[1] - a[1]).slice(0, 150).map(([key, count]) => { const [source, target] = key.split('|'); return { source, target, count }; });
    // Include Unand as the center; every partner edge is an observed shared-work relation.
    const centerWorks = works.filter(w => w.authors.some(a => a.unand)).length;
    const partners = { nodes: [...(centerWorks ? [{ id: 'I55892964', name: 'Universitas Andalas', count: centerWorks }] : []), ...nodes],
        edges: [...[...centerCounts].map(([id, count]) => ({ source: 'I55892964', target: id, count })), ...edgeList(partnerEdges)].slice(0, 150) };
    const topWorks = [...works].sort((a, b) => b.citations - a.citations).slice(0, 40), ids = new Set(topWorks.map(w => w.id));
    const citationEdges = [], coupling = new Map(), coCitation = new Map();
    const nodesWorks = topWorks.map(w => ({ id: w.id, name: w.title, count: w.citations }));
    for (const w of works)
        for (const ref of new Set(w.references))
            if (ids.has(w.id) && ids.has(ref) && ref !== w.id)
                citationEdges.push({ source: w.id, target: ref, count: 1 });
    const refs = topWorks.map(w => new Set(w.references));
    for (let i = 0; i < topWorks.length; i++)
        for (let j = i + 1; j < topWorks.length; j++) {
            const shared = [...refs[i]].filter(id => refs[j].has(id)).length;
            if (shared)
                coupling.set(`${topWorks[i].id}|${topWorks[j].id}`, shared);
        }
    for (const w of works) {
        const refs = [...new Set(w.references.filter(id => ids.has(id)))];
        for (let i = 0; i < refs.length; i++)
            for (let j = i + 1; j < refs.length; j++)
                addEdge(coCitation, refs[i], refs[j]);
    }
    const fEdges = edgeList(fundingEdges), fIds = [...new Set(fEdges.flatMap(e => [e.source, e.target]))].slice(0, 40);
    const funding = { nodes: fIds.map(id => ({ id, name: entities.funders[id]?.name || entities.topics[id]?.name || id, count: funderRows.find(r => r.id === id)?.count || 1 })), edges: fEdges.filter(e => fIds.includes(e.source) && fIds.includes(e.target)) };
    return { partners, funding, citations: { nodes: nodesWorks, edges: citationEdges.slice(0, 150) },
        coupling: { nodes: nodesWorks, edges: edgeList(coupling) }, cocitation: { nodes: nodesWorks, edges: edgeList(coCitation) } };
}
export function publicationPage(works, entities, filter, options = {}) {
    const selected = filteredWorks(works, filter, entities);
    const sort = options.sort || 'citations';
    selected.sort((a, b) => sort === 'year' ? (b.year || 0) - (a.year || 0) : sort === 'title' ? a.title.localeCompare(b.title) : b.citations - a.citations);
    const start = Math.max(0, Number(options.page || 0)) * 50;
    return { total: selected.length, rows: selected.slice(start, start + 50).map(w => ({ ...w, source_name: entities.sources[w.source]?.name || 'Tidak diketahui' })) };
}
