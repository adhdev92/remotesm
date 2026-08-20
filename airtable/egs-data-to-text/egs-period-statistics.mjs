/**
 * Epic Games Store freebie statistics by calendar period.
 * Accepts normalized promos, Airtable-style {id, fields} records, or an Airtable table.
 * No dependencies.
 */

/** @typedef {'month'|'quarter'|'season'|'halfYear'|'year'} PeriodType */
/** @typedef {'all'|'games'|'other'} Subgroup */
/** @typedef {{recordId?:string,title?:string,freebieStart?:string,freebieEnd?:string,fullPrice?:number|null,offerType?:string,namespace?:string,productSlug?:string,id?:string}} Promo */
/** @typedef {{id:string,fields:Record<string,unknown>}} RawPromoRecord */
/** @typedef {{fields?:Array<{id?:string,name:string}>,selectRecordsAsync:(options?:object)=>Promise<{records:Array<object>}>}} AirtableTableLike */
/** @typedef {Promo[]|RawPromoRecord[]|AirtableTableLike} PromoInput */
/** @typedef {{title?:string,freebieStart?:string,freebieEnd?:string,fullPrice?:string,offerType?:string,namespace?:string,productSlug?:string,id?:string}} PromoFieldMap */
/** @typedef {{from?:string,through?:string,gameOfferTypes?:string[],includeZeroPrices?:boolean,pricePrecision?:number,isGame?:(row:Promo)=>boolean,getIdentity?:(row:Promo)=>string|null,fieldMap?:Partial<PromoFieldMap>}} StatisticsOptions */

const PERIOD_TYPES = Object.freeze(["month", "quarter", "season", "halfYear", "year"]);
const DEFAULT_GAME_OFFER_TYPES = Object.freeze(["BASE_GAME", "EDITION", "GAME"]);
const ALIASES = Object.freeze({
  title: ["title", "offerTitle", "productTitle", "gameTitle", "name"],
  freebieStart: ["freebieStart", "promoStart", "promotionStart", "startDate", "start", "startsAt"],
  freebieEnd: ["freebieEnd", "promoEnd", "promotionEnd", "endDate", "end", "endsAt"],
  fullPrice: ["fullPrice", "originalPrice", "listPrice", "msrp", "price"],
  offerType: ["offerType", "rawOfferType", "type", "OFFER_TYPE"],
  namespace: ["namespace", "catalogNamespace"],
  productSlug: ["productSlug", "product_slug", "slug"],
  id: ["offerId", "catalogOfferId", "productId", "id"],
});

/**
 * Calculate one period type. Arrays return synchronously; Airtable tables return a Promise.
 * @param {PromoInput} input @param {PeriodType} period @param {StatisticsOptions=} options
 */
export function periodStatistics(input, period, options = {}) {
  assertPeriod(period);
  return withRows(input, options, (rows) => periodStatisticsFromRows(rows, period, options));
}

/**
 * Calculate month, quarter, meteorological season, half-year, and year statistics.
 * Arrays return synchronously; Airtable tables return a Promise.
 * @param {PromoInput} input @param {StatisticsOptions=} options
 */
export function allPeriodStatistics(input, options = {}) {
  return withRows(input, options, (rows) => Object.fromEntries(
    PERIOD_TYPES.map((period) => [period, periodStatisticsFromRows(rows, period, options)]),
  ));
}

/**
 * Return the five period summaries containing referenceDate.
 * @param {PromoInput} input @param {string} referenceDate @param {StatisticsOptions=} options
 */
export function statisticsForDate(input, referenceDate, options = {}) {
  assertDate(referenceDate);
  return withRows(input, options, (rows) => {
    const prepared = prepareRows(rows, options).filtered;
    return Object.fromEntries(PERIOD_TYPES.map((period) => {
      const descriptor = getPeriodDescriptor(referenceDate, period);
      const matches = prepared.filter((row) => row.freebieStart >= descriptor.start && row.freebieStart <= descriptor.end);
      return [period, matches.length ? { period: descriptor, groups: summarizeGroups(matches, options) } : null];
    }));
  });
}

/**
 * Normalize supported inputs to Promo[]. Raw arrays are synchronous; Airtable tables are async.
 * @param {PromoInput} input @param {StatisticsOptions=} options @returns {Promo[]|Promise<Promo[]>}
 */
export function resolvePromoRecords(input, options = {}) {
  if (Array.isArray(input)) return normalizeArray(input, options);
  if (isTable(input)) return recordsFromAirtableTable(input).then((records) => normalizeArray(records, options));
  throw new TypeError("Expected promo records or an Airtable table object.");
}

/**
 * Infer raw field roles. Explicit options.fieldMap entries override inference.
 * @param {RawPromoRecord[]} records @param {StatisticsOptions=} options @returns {PromoFieldMap}
 */
export function inferPromoFieldMap(records, options = {}) {
  const fields = records.map((record) => record?.fields).filter((value) => value && typeof value === "object");
  if (!fields.length) return { ...(options.fieldMap ?? {}) };
  const keys = [...new Set(fields.flatMap((value) => Object.keys(value)))];
  const samples = Object.fromEntries(keys.map((key) => [key, fields.map((value) => value[key]).filter(hasValue).slice(0, 100)]));
  const map = {};

  for (const role of Object.keys(ALIASES)) {
    const explicit = options.fieldMap?.[role];
    map[role] = explicit && keys.includes(explicit) ? explicit : bestAlias(keys, ALIASES[role]);
  }

  const used = new Set(Object.values(map).filter(Boolean));
  map.offerType ??= bestValue(keys, used, samples, (values) => ratio(values, isOfferType));
  if (map.offerType) used.add(map.offerType);

  const dateCandidates = keys
    .filter((key) => !used.has(key))
    .map((key) => ({ key, score: ratio(samples[key], (value) => Boolean(toDate(value))) }))
    .filter(({ score }) => score >= 0.6)
    .sort((a, b) => b.score - a.score);
  map.freebieStart ??= dateCandidates[0]?.key;
  if (map.freebieStart) used.add(map.freebieStart);
  map.freebieEnd ??= dateCandidates.find(({ key }) => !used.has(key))?.key;
  if (map.freebieEnd) used.add(map.freebieEnd);

  map.fullPrice ??= bestValue(keys, used, samples, priceScore);
  if (map.fullPrice) used.add(map.fullPrice);
  map.productSlug ??= bestValue(keys, used, samples, (values) => ratio(values, isSlug));
  if (map.productSlug) used.add(map.productSlug);
  map.namespace ??= bestValue(keys, used, samples, (values) => ratio(values, isNamespace));
  if (map.namespace) used.add(map.namespace);
  map.title ??= bestValue(keys, used, samples, titleScore);

  return { ...map, ...(options.fieldMap ?? {}) };
}

/**
 * Read an Airtable scripting-extension table into {id, fields} records.
 * @param {AirtableTableLike} table @returns {Promise<RawPromoRecord[]>}
 */
export async function recordsFromAirtableTable(table) {
  if (!isTable(table)) throw new TypeError("table must expose selectRecordsAsync().");
  const tableFields = Array.isArray(table.fields) ? table.fields : [];
  const query = tableFields.length
    ? await table.selectRecordsAsync({ fields: tableFields })
    : await table.selectRecordsAsync();
  return (query?.records ?? []).map((record) => {
    const fields = {};
    if (tableFields.length && typeof record?.getCellValue === "function") {
      for (const field of tableFields) fields[field.name] = record.getCellValue(field);
    } else if (record?.fields && typeof record.fields === "object") {
      Object.assign(fields, record.fields);
    }
    return { id: String(record?.id ?? ""), fields };
  });
}

/** @param {Promo} row @param {StatisticsOptions=} options @returns {'games'|'other'} */
export function classifyFreebie(row, options = {}) {
  if (typeof options.isGame === "function") return options.isGame(row) ? "games" : "other";
  const gameTypes = new Set((options.gameOfferTypes ?? DEFAULT_GAME_OFFER_TYPES).map((value) => String(value).toUpperCase()));
  return gameTypes.has(String(row.offerType ?? "").toUpperCase()) ? "games" : "other";
}

/** @param {string} date @param {PeriodType} period */
export function getPeriodDescriptor(date, period) {
  assertDate(date); assertPeriod(period);
  const year = +date.slice(0, 4); const month = +date.slice(5, 7);
  if (period === "month") return descriptor(period, date.slice(0, 7), formatMonth(date), iso(year, month, 1), iso(year, month, daysInMonth(year, month)));
  if (period === "quarter") {
    const quarter = Math.ceil(month / 3); const startMonth = (quarter - 1) * 3 + 1; const endMonth = startMonth + 2;
    return descriptor(period, `${year}-Q${quarter}`, `${year} Q${quarter}`, iso(year, startMonth, 1), iso(year, endMonth, daysInMonth(year, endMonth)));
  }
  if (period === "halfYear") {
    const half = month <= 6 ? 1 : 2; const startMonth = half === 1 ? 1 : 7; const endMonth = half === 1 ? 6 : 12;
    return descriptor(period, `${year}-H${half}`, `${year} H${half}`, iso(year, startMonth, 1), iso(year, endMonth, daysInMonth(year, endMonth)));
  }
  if (period === "year") return descriptor(period, String(year), String(year), `${year}-01-01`, `${year}-12-31`);
  if (month === 12 || month <= 2) {
    const seasonYear = month === 12 ? year + 1 : year;
    return descriptor(period, `${seasonYear}-winter`, `${seasonYear} Winter`, `${seasonYear - 1}-12-01`, iso(seasonYear, 2, daysInMonth(seasonYear, 2)));
  }
  if (month <= 5) return descriptor(period, `${year}-spring`, `${year} Spring`, `${year}-03-01`, `${year}-05-31`);
  if (month <= 8) return descriptor(period, `${year}-summer`, `${year} Summer`, `${year}-06-01`, `${year}-08-31`);
  return descriptor(period, `${year}-autumn`, `${year} Autumn`, `${year}-09-01`, `${year}-11-30`);
}

function periodStatisticsFromRows(rows, period, options) {
  const prepared = prepareRows(rows, options).filtered; const buckets = new Map();
  for (const row of prepared) {
    const d = getPeriodDescriptor(row.freebieStart, period); const bucket = buckets.get(d.key) ?? { descriptor: d, rows: [] };
    bucket.rows.push(row); buckets.set(d.key, bucket);
  }
  const periods = [...buckets.values()]
    .sort((a, b) => a.descriptor.start.localeCompare(b.descriptor.start))
    .map(({ descriptor: periodDescriptor, rows: periodRows }) => ({ period: periodDescriptor, groups: summarizeGroups(periodRows, options) }));
  return { periodType: period, periods, series: summarizeSeries(periods) };
}

function withRows(input, options, callback) {
  const resolved = resolvePromoRecords(input, options);
  return resolved && typeof resolved.then === "function" ? resolved.then(callback) : callback(resolved);
}

function normalizeArray(rows, options) {
  const raw = rows.filter(isRaw); const fieldMap = raw.length ? inferPromoFieldMap(raw, options) : null;
  return rows.map((row) => isRaw(row) ? normalizeRaw(row, fieldMap ?? {}) : normalizePromo(row));
}

function normalizeRaw(record, map) {
  const fields = record.fields ?? {};
  return {
    recordId: String(record.id ?? ""),
    title: toText(fields[map.title]), freebieStart: toDate(fields[map.freebieStart]), freebieEnd: toDate(fields[map.freebieEnd]),
    fullPrice: toPrice(fields[map.fullPrice]), offerType: toText(fields[map.offerType]), namespace: toText(fields[map.namespace]),
    productSlug: toText(fields[map.productSlug]), id: toText(fields[map.id]),
  };
}

function normalizePromo(row) {
  return { ...row, title: toText(row?.title), freebieStart: toDate(row?.freebieStart), freebieEnd: toDate(row?.freebieEnd), fullPrice: toPrice(row?.fullPrice), offerType: toText(row?.offerType), namespace: toText(row?.namespace), productSlug: toText(row?.productSlug), id: toText(row?.id) };
}

function prepareRows(rows, options) {
  const from = options.from ?? null; const through = options.through ?? null;
  if (from) assertDate(from); if (through) assertDate(through); if (from && through && from > through) throw new RangeError("options.from must not be after options.through.");
  const global = rows
    .filter((row) => row?.freebieStart)
    .map((row, index) => ({ ...row, __index: index, freebieStart: row.freebieStart.slice(0, 10) }))
    .filter((row) => isDate(row.freebieStart))
    .sort((a, b) => a.freebieStart.localeCompare(b.freebieStart) || a.__index - b.__index);
  const firstDate = new Map();
  for (const row of global) {
    const identity = identityOf(row, options); if (!identity) continue;
    if (!firstDate.has(identity) || row.freebieStart < firstDate.get(identity)) firstDate.set(identity, row.freebieStart);
  }
  const decorated = global.map((row) => {
    const identity = identityOf(row, options); const first = identity ? firstDate.get(identity) : null;
    return { ...row, __group: classifyFreebie(row, options), __repeatStatus: first && row.freebieStart > first ? "returning" : "firstTime" };
  });
  return { global: decorated, filtered: decorated.filter((row) => (!from || row.freebieStart >= from) && (!through || row.freebieStart <= through)) };
}

function summarizeGroups(rows, options) {
  return { all: summarize(rows, options), games: summarize(rows.filter((row) => row.__group === "games"), options), other: summarize(rows.filter((row) => row.__group === "other"), options) };
}

function summarize(rows, options) {
  const total = rows.length; const rotationCount = new Set(rows.map((row) => row.freebieStart)).size;
  const firstTime = rows.filter((row) => row.__repeatStatus === "firstTime").length; const returning = total - firstTime;
  return { total, rotationCount, averagePerRotation: rotationCount ? total / rotationCount : null, firstTime, returning, firstTimeRate: total ? firstTime / total : null, returningRate: total ? returning / total : null, price: priceStats(rows, options) };
}

function priceStats(rows, options) {
  const precision = options.pricePrecision ?? 2; const includeZero = options.includeZeroPrices ?? false;
  const valid = rows.map((row) => row.fullPrice).filter((value) => typeof value === "number" && Number.isFinite(value) && value >= 0);
  const prices = valid.filter((value) => includeZero ? value >= 0 : value > 0).map((value) => round(value, precision));
  const knownCount = valid.length; const missingCount = rows.length - knownCount; const zeroPriceCount = valid.filter((value) => value === 0).length;
  if (!prices.length) return { knownCount, sampleCount: 0, missingCount, zeroPriceCount, total: 0, average: null, min: null, max: null, mean: null, mode: null, modeFrequency: 0 };
  const total = round(prices.reduce((sum, value) => sum + value, 0), precision); const average = round(total / prices.length, precision); const frequencies = new Map();
  for (const price of prices) frequencies.set(price, (frequencies.get(price) ?? 0) + 1);
  const modeFrequency = Math.max(...frequencies.values()); const modes = modeFrequency > 1 ? [...frequencies].filter(([, frequency]) => frequency === modeFrequency).map(([price]) => price).sort((a, b) => a - b) : [];
  return { knownCount, sampleCount: prices.length, missingCount, zeroPriceCount, total, average, min: Math.min(...prices), max: Math.max(...prices), mean: average, mode: !modes.length ? null : modes.length === 1 ? modes[0] : modes, modeFrequency };
}

function summarizeSeries(periods) {
  const groups = (subgroup) => periods.map((period) => period.groups[subgroup]);
  const summarizeSubgroup = (subgroup) => {
    const values = groups(subgroup); const priced = values.filter((group) => group.price.sampleCount > 0);
    return { averageFreebiesPerPeriod: avg(values.map((group) => group.total)), averageFirstTimePerPeriod: avg(values.map((group) => group.firstTime)), averageReturningPerPeriod: avg(values.map((group) => group.returning)), averageTotalPricePerPeriod: avg(priced.map((group) => group.price.total)), averagePricePerFreebieAcrossPeriods: avg(priced.map((group) => group.price.average)) };
  };
  return { periodCount: periods.length, all: summarizeSubgroup("all"), games: summarizeSubgroup("games"), other: summarizeSubgroup("other") };
}

function identityOf(row, options) {
  if (typeof options.getIdentity === "function") return options.getIdentity(row);
  const namespace = token(row.namespace); const slug = slugify(row.productSlug); const title = titleKey(row.title);
  if (namespace && slug) return `ns-slug:${namespace}:${slug}`; if (slug) return `slug:${slug}`; if (namespace && title) return `ns-title:${namespace}:${title}`; return title ? `title:${title}` : null;
}

function bestAlias(keys, aliases) {
  let best = null; let score = 0;
  for (const key of keys) for (let index = 0; index < aliases.length; index += 1) {
    const k = fieldKey(key); const a = fieldKey(aliases[index]); const next = k === a ? 100 - index : k.includes(a) ? 60 - index : 0;
    if (next > score) { best = key; score = next; }
  }
  return best;
}

function bestValue(keys, used, samples, scorer) {
  let best = null; let score = 0;
  for (const key of keys) if (!used.has(key)) { const next = scorer(samples[key] ?? []); if (next > score) { best = key; score = next; } }
  return score >= 0.6 ? best : null;
}

function priceScore(values) {
  const parsed = values.map(toPrice).filter((value) => typeof value === "number" && Number.isFinite(value) && value >= 0);
  return values.length ? parsed.length / values.length : 0;
}

function titleScore(values) {
  const good = values.map(toText).filter((value) => value && value.length <= 200 && !toDate(value) && !isOfferType(value) && !/^https?:\/\//i.test(value) && !isNamespace(value));
  return values.length ? good.length / values.length : 0;
}

function isOfferType(value) { return ["BASE_GAME", "GAME", "EDITION", "ADD_ON", "OTHERS", "BUNDLE", "DLC"].includes(String(value ?? "").trim().toUpperCase()); }
function isSlug(value) { const text = String(value ?? "").trim(); return Boolean(text && text.length <= 180 && /[a-z]/i.test(text) && !/^https?:\/\//i.test(text) && !toDate(text)); }
function isNamespace(value) { const text = String(value ?? "").trim(); return text.length >= 16 && text.length <= 64 && /^[a-f0-9-]+$/i.test(text); }
function ratio(values, predicate) { return values.length ? values.filter(predicate).length / values.length : 0; }
function hasValue(value) { return value !== null && value !== undefined && value !== ""; }
function isRaw(row) { return Boolean(row && typeof row === "object" && row.fields && typeof row.fields === "object" && !Array.isArray(row.fields)); }
function isTable(value) { return Boolean(value && typeof value === "object" && typeof value.selectRecordsAsync === "function"); }
function toText(value) { if (value == null) return undefined; if (typeof value === "string") return value.trim() || undefined; if (typeof value === "number" || typeof value === "boolean") return String(value); if (Array.isArray(value)) return value.map((item) => toText(item?.name ?? item)).filter(Boolean).join(", ") || undefined; if (typeof value === "object") return toText(value.name ?? value.value ?? value.id); return undefined; }
function toDate(value) { if (value instanceof Date && Number.isFinite(value.valueOf())) return value.toISOString().slice(0, 10); const text = toText(value); if (!text) return undefined; if (/^\d{4}-\d{2}-\d{2}/.test(text)) { const date = text.slice(0, 10); return isDate(date) ? date : undefined; } const parsed = new Date(text); return Number.isFinite(parsed.valueOf()) ? parsed.toISOString().slice(0, 10) : undefined; }
function toPrice(value) { if (typeof value === "number") return Number.isFinite(value) ? value : null; if (value && typeof value === "object") return toPrice(value.amount ?? value.value ?? value.originalPrice ?? value.discountPrice); const text = String(value ?? "").trim(); if (!text) return null; const parsed = Number(text.replace(/[^0-9,.-]+/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "")); return Number.isFinite(parsed) ? parsed : null; }
function descriptor(type, key, label, start, end) { return { type, key, label, start, end }; }
function fieldKey(value) { return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function token(value) { return String(value ?? "").trim().toLowerCase(); }
function slugify(value) { return token(value).replace(/^bundles\//, "").replace(/\/home$/, "").replace(/-[a-f0-9]{6}$/i, ""); }
function titleKey(value) { return token(value).replace(/[^a-z0-9]+/g, " ").replace(/\b(standard|deluxe|complete|edition)\b/g, " ").replace(/\s+/g, " ").trim(); }
function avg(values) { const numeric = values.filter((value) => typeof value === "number" && Number.isFinite(value)); return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : null; }
function round(value, precision) { const factor = 10 ** precision; return Math.round((value + Number.EPSILON) * factor) / factor; }
function daysInMonth(year, month) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
function iso(year, month, day) { return [year, month, day].map((value, index) => String(value).padStart(index ? 2 : 4, "0")).join("-"); }
function formatMonth(date) { return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`)); }
function isDate(date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? ""))) return false; const parsed = new Date(`${date}T00:00:00Z`); return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date; }
function assertDate(date) { if (!isDate(date)) throw new TypeError(`Invalid YYYY-MM-DD date: ${date}`); }
function assertPeriod(period) { if (!PERIOD_TYPES.includes(period)) throw new TypeError(`Unknown period type: ${period}.`); }

export default allPeriodStatistics;
