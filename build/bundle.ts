//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region src/cache.ts
var cache_exports = /* @__PURE__ */ __exportAll({
	clearRemoteEsmVm: () => clearRemoteEsmVm,
	remoteEsmVm: () => remoteEsmVm,
	vmMemo: () => vmMemo
});
const root = globalThis;
const remoteEsmVm = root.__remoteEsmVm || (root.__remoteEsmVm = {
	text: /* @__PURE__ */ new Map(),
	json: /* @__PURE__ */ new Map(),
	module: /* @__PURE__ */ new Map(),
	dtsUrl: /* @__PURE__ */ new Map(),
	dtsGraph: /* @__PURE__ */ new Map(),
	package: /* @__PURE__ */ new Map(),
	ts: null,
	converter: null
});
/** Memoize an async computation in a virtual-memory map. */
function vmMemo(map, key, factory) {
	if (map.has(key)) return map.get(key);
	const promise = Promise.resolve().then(factory).catch((error) => {
		map.delete(key);
		throw error;
	});
	map.set(key, promise);
	return promise;
}
/** Clear all virtual-memory caches except the object identity itself. */
function clearRemoteEsmVm() {
	remoteEsmVm.text.clear();
	remoteEsmVm.json.clear();
	remoteEsmVm.module.clear();
	remoteEsmVm.dtsUrl.clear();
	remoteEsmVm.dtsGraph.clear();
	remoteEsmVm.package.clear();
	remoteEsmVm.ts = null;
	remoteEsmVm.converter = null;
}
//#endregion
//#region src/bli-cache/index.ts
/**
* Environment-agnostic runtime-module and TypeScript-declaration resolver.
*
* Modes:
* - standaloneScript: bare and `npm: ` references resolve through esm.sh.
* - nodenext: bare and `npm: ` references resolve through local node_modules,
*   searching upward from the importing file. CDN fallback is disabled by default.
* - monaco: local-first package resolution with CDN fallback and optional
*   monaco-editor-auto-typings integration.
*
* Remote runtime modules can be persisted in Cache Storage. In Airtable, the
* default cache is scoped to the current `base.id`, for example:
*
*   auto-typings:appXXXXXXXXXXXXXX
*
* Requested aliases such as `zod` point to exact records such as `zod @4.2.3`.
* The exact record stores ESM source text and expiry metadata.
*/
var AutoTypings = class AutoTypings {
	static sharedCache = createMemoryCache();
	/**
	* @param {object} [options]
	* @param {'standaloneScript'|'nodenext'|'monaco'} [options.mode='standaloneScript']
	* @param {object} [options.libs]
	* @param {(input: string, init?: object) => Promise<any>} [options.libs.fetch]
	* @param {(specifier: string) => Promise<any>} [options.libs.importModule]
	* @param {typeof URL} [options.libs.URL]
	* @param {typeof Response} [options.libs.Response]
	* @param {typeof Blob} [options.libs.Blob]
	* @param {CacheStorage} [options.libs.cacheStorage]
	* @param {(url: URL) => Promise<string>|string} [options.libs.readTextFile]
	* @param {(path: string) => string|URL} [options.libs.pathToFileURL]
	* @param {() => string} [options.libs.cwd]
	* @param {Console|Pick<Console, 'error'|'warn'>} [options.libs.console]
	* @param {any} [options.libs.monaco]
	* @param {any} [options.libs.MonacoAutoTypings]
	* @param {any} [options.libs.editor]
	* @param {string|URL} [options.projectBaseURL]
	* @param {string|URL|null} [options.nodeModulesBaseURL]
	* @param {string|URL} [options.cdnBaseURL='https://esm.sh/']
	* @param {string|URL} [options.packageFilesBaseURL='https://cdn.jsdelivr.net/npm/']
	* @param {boolean} [options.allowCdnFallback]
	* @param {object} [options.cache]
	* @param {string} [options.cacheScope]
	* @param {{value:number, unit:string}} [options.cacheCycleLength]
	* @param {boolean} [options.persistentModuleCache=true]
	* @param {string} [options.moduleCacheName='auto-typings']
	* @param {number} [options.maxTypeDepth=8]
	* @param {number} [options.maxTypeFiles=256]
	* @param {number} [options.typeConcurrency=8]
	* @param {(error: unknown) => void} [options.onError]
	* @param {string} [options.monacoFileRoot='inmemory://model/']
	* @param {any} [options.monacoSourceCache]
	* @param {any} [options.monacoSourceResolver]
	*/
	constructor({ mode = "standaloneScript", libs: { fetch: fetchImpl = globalThis.fetch?.bind(globalThis), importModule = (specifier) => import(
		/* @vite-ignore */
		specifier
), URL: URLImpl = globalThis.URL, Response: ResponseImpl = globalThis.Response, Blob: BlobImpl = globalThis.Blob, cacheStorage = globalThis.caches, readTextFile, pathToFileURL, cwd = globalThis.process?.cwd?.bind(globalThis.process), console: consoleImpl = globalThis.console, monaco, MonacoAutoTypings, editor } = {}, projectBaseURL, nodeModulesBaseURL, cdnBaseURL = "https://esm.sh/", packageFilesBaseURL = "https://cdn.jsdelivr.net/npm/", allowCdnFallback, cache = AutoTypings.sharedCache, cacheScope, cacheCycleLength = {
		value: 24,
		unit: "hours"
	}, persistentModuleCache = true, moduleCacheName = "auto-typings", maxTypeDepth = 8, maxTypeFiles = 256, typeConcurrency = 8, onError, monacoFileRoot = "inmemory://model/", monacoSourceCache, monacoSourceResolver } = {}) {
		if (!URLImpl) throw new TypeError("A URL implementation is required through libs.URL or globalThis.URL");
		if (![
			"standaloneScript",
			"nodenext",
			"monaco"
		].includes(mode)) throw new TypeError(`Unsupported mode: ${mode} `);
		this.mode = mode;
		this.libs = {
			fetch: fetchImpl,
			importModule,
			URL: URLImpl,
			Response: ResponseImpl,
			Blob: BlobImpl,
			cacheStorage,
			readTextFile,
			pathToFileURL,
			cwd,
			console: consoleImpl,
			monaco,
			MonacoAutoTypings,
			editor
		};
		this.cache = normalizeMemoryCache(cache);
		this.maxTypeDepth = toPositiveInteger(maxTypeDepth, "maxTypeDepth");
		this.maxTypeFiles = toPositiveInteger(maxTypeFiles, "maxTypeFiles");
		this.typeConcurrency = toPositiveInteger(typeConcurrency, "typeConcurrency");
		this.onError = onError ?? ((error) => {
			consoleImpl?.error?.(error);
		});
		this.projectBaseURL = this.#normalizeBaseURL(projectBaseURL);
		this.cdnBaseURL = new URLImpl(String(cdnBaseURL), this.projectBaseURL);
		this.packageFilesBaseURL = new URLImpl(String(packageFilesBaseURL), this.projectBaseURL);
		this.allowCdnFallback = mode === "standaloneScript" ? true : allowCdnFallback ?? mode !== "nodenext";
		if (mode === "standaloneScript") this.nodeModulesBaseURL = null;
		else if (nodeModulesBaseURL === null) this.nodeModulesBaseURL = null;
		else this.nodeModulesBaseURL = new URLImpl(String(nodeModulesBaseURL ?? "./node_modules/"), this.#asDirectoryURL(this.projectBaseURL));
		this.cacheCycleLength = normalizeCacheCycleLength(cacheCycleLength);
		this.cacheCycleMilliseconds = cacheCycleToMilliseconds(this.cacheCycleLength);
		const detectedScope = cacheScope ?? detectCurrentBaseId();
		this.persistentModuleCache = persistentModuleCache && detectedScope && cacheStorage && ResponseImpl ? {
			scope: String(detectedScope),
			cacheName: `${moduleCacheName ?? detectedScope} `,
			storage: cacheStorage,
			Response: ResponseImpl,
			Blob: BlobImpl,
			promise: null
		} : null;
		this.monacoOptions = {
			fileRoot: monacoFileRoot,
			sourceCache: monacoSourceCache,
			sourceResolver: monacoSourceResolver
		};
		this.monacoLoaders = /* @__PURE__ */ new Map();
		this.monacoModels = /* @__PURE__ */ new Map();
		this.monacoAliases = Object.create(null);
		if (mode === "monaco" && (!monaco || !MonacoAutoTypings || !editor)) throw new TypeError("monaco mode requires libs.monaco, libs.MonacoAutoTypings, and libs.editor");
	}
	/**
	* Parse an npm-style package reference.
	*/
	parsePackageReference(value) {
		const match = String(value).replace(/^\/+/, "").match(/^(?<name>@[^/]+\/[^/@]+|[^/@]+)(?:@(?<version>[^/]+))?(?:\/(?<subpath>.*))?$/);
		if (!match?.groups) throw new TypeError(`Invalid package reference: ${value} `);
		return {
			name: match.groups.name,
			version: match.groups.version,
			subpath: match.groups.subpath || ""
		};
	}
	/**
	* Resolve a package reference, path, or URL.
	*/
	async resolve(specifier, parent = this.projectBaseURL.href) {
		const key = [
			this.mode,
			this.projectBaseURL.href,
			this.nodeModulesBaseURL?.href ?? "",
			this.cdnBaseURL.href,
			String(this.allowCdnFallback),
			String(parent),
			String(specifier)
		].join("\n");
		if (this.cache.resolutions.has(key)) return this.cache.resolutions.get(key);
		const promise = this.#resolveUncached(String(specifier), parent);
		this.cache.resolutions.set(key, promise);
		try {
			return await promise;
		} catch (error) {
			this.cache.resolutions.delete(key);
			throw error;
		}
	}
	/**
	* Load and recursively collect TypeScript declarations.
	*/
	async types(specifier, parent = this.projectBaseURL.href) {
		const resolved = await this.resolve(specifier, parent);
		const key = resolved.typeCacheKey;
		if (this.cache.types.has(key)) return this.cache.types.get(key);
		const promise = this.#loadTypesUncached(resolved);
		this.cache.types.set(key, promise);
		try {
			const bundle = await promise;
			if (this.mode === "monaco") await this.#registerMonaco(resolved, bundle);
			return bundle;
		} catch (error) {
			this.cache.types.delete(key);
			throw error;
		}
	}
	/**
	* Resolve and import a runtime module, using persistent source cache first.
	*/
	async import(specifier, parent = this.projectBaseURL.href) {
		const resolved = await this.resolve(specifier, parent);
		const memoryKey = resolved.runtimeURL;
		if (!this.cache.modules.has(memoryKey)) {
			const promise = this.#importResolvedModule(resolved);
			this.cache.modules.set(memoryKey, promise);
			promise.catch(() => {
				this.cache.modules.delete(memoryKey);
			});
		}
		return this.cache.modules.get(memoryKey);
	}
	/**
	* Resolve a reference and return its runtime value and declarations.
	*/
	async load(specifier, { parent = this.projectBaseURL.href, value = true, types = true } = {}) {
		const resolution = await this.resolve(specifier, parent);
		const [runtimeValue, declarationBundle] = await Promise.all([value ? this.import(specifier, parent) : void 0, types ? this.types(specifier, parent) : void 0]);
		return {
			resolution,
			...value ? { value: runtimeValue } : {},
			...types ? { types: declarationBundle } : {}
		};
	}
	/**
	* Read text using the injected fetch or filesystem adapter.
	*/
	async text(url, { optional = false, cache = true } = {}) {
		const href = this.#toURL(url).href;
		if (cache && this.cache.text.has(href)) return this.cache.text.get(href);
		const promise = this.#readURLText(href, optional);
		if (cache) this.cache.text.set(href, promise);
		try {
			return await promise;
		} catch (error) {
			if (cache) this.cache.text.delete(href);
			throw error;
		}
	}
	/**
	* Read and parse JSON using the injected adapters.
	*/
	async json(url, options) {
		const href = this.#toURL(url).href;
		if (this.cache.json.has(href)) return this.cache.json.get(href);
		const promise = this.text(href, options).then((text) => text === void 0 ? void 0 : JSON.parse(text));
		this.cache.json.set(href, promise);
		promise.catch(() => {
			this.cache.json.delete(href);
		});
		return promise;
	}
	/**
	* List exact persistently cached module records for the current scope.
	*/
	async listCachedModules({ includeSource = false, includeExpired = true } = {}) {
		const cache = await this.#openPersistentModuleCache();
		if (!cache) return [];
		const requests = await cache.keys();
		const records = [];
		for (const request of requests) {
			if (!new this.libs.URL(request.url).pathname.includes("/modules/")) continue;
			const response = await cache.match(request);
			if (!response) continue;
			try {
				const record = await response.json();
				if (record?.type !== "module") continue;
				const expired = !this.#isPersistentRecordFresh(record);
				if (!includeExpired && expired) continue;
				records.push({
					...record,
					...includeSource ? {} : { source: void 0 },
					expired
				});
			} catch {}
		}
		return records.sort((left, right) => String(left.key).localeCompare(String(right.key)));
	}
	/**
	* Get a cached module record by an alias or exact key.
	*/
	async getCachedModule(key, { includeExpired = false } = {}) {
		const cache = await this.#openPersistentModuleCache();
		if (!cache) return;
		const requestedKey = String(key);
		const moduleKey = (await this.#readPersistentRecord(cache, "aliases", requestedKey))?.moduleKey ?? requestedKey;
		const record = await this.#readPersistentRecord(cache, "modules", moduleKey);
		if (!record) return;
		if (!includeExpired && !this.#isPersistentRecordFresh(record)) return;
		return record;
	}
	/**
	* Delete an exact module record and every alias that points to it.
	*/
	async deleteCachedModule(key) {
		const cache = await this.#openPersistentModuleCache();
		if (!cache) return false;
		const suppliedKey = String(key);
		const moduleKey = (await this.#readPersistentRecord(cache, "aliases", suppliedKey))?.moduleKey ?? suppliedKey;
		let deleted = await cache.delete(this.#persistentRecordURL("modules", moduleKey));
		deleted = await cache.delete(this.#persistentRecordURL("aliases", suppliedKey)) || deleted;
		for (const request of await cache.keys()) {
			if (!new this.libs.URL(request.url).pathname.includes("/aliases/")) continue;
			const response = await cache.match(request);
			if (!response) continue;
			try {
				if ((await response.json())?.moduleKey === moduleKey) deleted = await cache.delete(request) || deleted;
			} catch {}
		}
		this.cache.modules.clear();
		return deleted;
	}
	/**
	* Clear only in-memory caches for the current runtime.
	*/
	clearMemoryCache() {
		for (const map of Object.values(this.cache)) map.clear();
	}
	/**
	* Delete the persistent Cache Storage cache for the current scope.
	*/
	async clearPersistentCache() {
		if (!this.persistentModuleCache) return false;
		const { storage, cacheName } = this.persistentModuleCache;
		this.persistentModuleCache.promise = null;
		return storage.delete(cacheName);
	}
	/**
	* Clear memory and, by default, persistent state.
	*/
	async clearCache({ persistent = true } = {}) {
		this.clearMemoryCache();
		return persistent ? this.clearPersistentCache() : true;
	}
	async dispose() {
		for (const pending of this.monacoLoaders.values()) try {
			const result = await pending;
			result?.loader?.dispose?.();
			result?.model?.dispose?.();
		} catch {}
		for (const model of new Set(this.monacoModels.values())) if (model !== this.libs.editor?.getModel?.()) model.dispose?.();
		this.monacoLoaders.clear();
		this.monacoModels.clear();
	}
	async #importResolvedModule(resolved) {
		if (!this.persistentModuleCache || !/^https?:/.test(resolved.runtimeURL) || !this.libs.fetch) return this.libs.importModule(resolved.runtimeURL);
		const requestedKey = this.#requestedModuleCacheKey(resolved);
		let cachedRecord;
		try {
			cachedRecord = await this.#getFreshPersistentModule(requestedKey);
		} catch (error) {
			this.onError?.(error);
		}
		if (cachedRecord) try {
			return await this.#importCachedModuleSource(cachedRecord);
		} catch (error) {
			this.onError?.(error);
			await this.deleteCachedModule(cachedRecord.key).catch(() => {});
		}
		try {
			const freshRecord = await this.#fetchAndPersistModule(resolved, requestedKey);
			return await this.#importCachedModuleSource(freshRecord);
		} catch (error) {
			this.onError?.(error);
			return this.libs.importModule(resolved.runtimeURL);
		}
	}
	async #openPersistentModuleCache() {
		if (!this.persistentModuleCache) return null;
		const config = this.persistentModuleCache;
		config.promise ??= config.storage.open(config.cacheName);
		return config.promise;
	}
	#persistentRecordURL(kind, key) {
		const scope = this.persistentModuleCache?.scope ?? "default";
		return new this.libs.URL(`${encodeURIComponent(scope)}/${kind}/${encodeURIComponent(key)}`, "https://auto-typings.invalid/").href;
	}
	async #readPersistentRecord(cache, kind, key) {
		const response = await cache.match(this.#persistentRecordURL(kind, key));
		if (!response) return;
		try {
			return await response.json();
		} catch {
			return;
		}
	}
	async #writePersistentRecord(cache, kind, key, value) {
		const ResponseImpl = this.persistentModuleCache.Response;
		const response = new ResponseImpl(JSON.stringify(value), { headers: { "content-type": "application/json; charset=utf-8" } });
		await cache.put(this.#persistentRecordURL(kind, key), response);
	}
	#isPersistentRecordFresh(record) {
		return record && Number.isFinite(record.expiresAt) && record.expiresAt > Date.now();
	}
	async #getFreshPersistentModule(requestedKey) {
		const cache = await this.#openPersistentModuleCache();
		if (!cache) return;
		const alias = await this.#readPersistentRecord(cache, "aliases", requestedKey);
		if (alias && !this.#isPersistentRecordFresh(alias)) await cache.delete(this.#persistentRecordURL("aliases", requestedKey));
		const moduleKey = alias && this.#isPersistentRecordFresh(alias) ? alias.moduleKey : requestedKey;
		const record = await this.#readPersistentRecord(cache, "modules", moduleKey);
		if (!record) return;
		if (!this.#isPersistentRecordFresh(record)) {
			await cache.delete(this.#persistentRecordURL("modules", moduleKey));
			if (alias) await cache.delete(this.#persistentRecordURL("aliases", requestedKey));
			return;
		}
		return record;
	}
	async #fetchAndPersistModule(resolved, requestedKey) {
		const cache = await this.#openPersistentModuleCache();
		if (!cache) throw new Error("Persistent module cache is unavailable");
		const sourceRequestURL = this.#cacheableModuleSourceURL(resolved);
		const response = await this.libs.fetch(sourceRequestURL, { method: "GET" });
		if (!response?.ok) throw new Error(`Failed to fetch cacheable module ${sourceRequestURL}: ${response?.status ?? "unknown"} ${response?.statusText ?? ""}`.trim());
		const source = await response.text();
		const sourceURL = response.url || sourceRequestURL;
		const exactVersion = this.#inferExactModuleVersion(resolved, response, source);
		const moduleKey = this.#exactModuleCacheKey(resolved, exactVersion);
		const cachedAt = Date.now();
		const expiresAt = cachedAt + this.cacheCycleMilliseconds;
		const record = {
			type: "module",
			key: moduleKey,
			requestedKey,
			packageName: resolved.packageRef?.name,
			version: exactVersion,
			subpath: resolved.packageRef?.subpath ?? "",
			runtimeURL: resolved.runtimeURL,
			sourceURL,
			source,
			cachedAt,
			expiresAt,
			cacheCycleLength: { ...this.cacheCycleLength }
		};
		const aliases = /* @__PURE__ */ new Set([
			requestedKey,
			moduleKey,
			resolved.original,
			resolved.runtimeURL
		]);
		await this.#writePersistentRecord(cache, "modules", moduleKey, record);
		await Promise.all(Array.from(aliases).filter(Boolean).map((aliasKey) => this.#writePersistentRecord(cache, "aliases", String(aliasKey), {
			type: "alias",
			key: String(aliasKey),
			moduleKey,
			cachedAt,
			expiresAt
		})));
		return record;
	}
	#requestedModuleCacheKey(resolved) {
		if (!resolved.packageRef) return resolved.runtimeURL;
		const { name, version, subpath } = resolved.packageRef;
		return `${name}${version ? `@${version}` : ""}${subpath ? `/${subpath}` : ""}${this.#meaningfulRuntimeQuery(resolved.runtimeURL)}`;
	}
	#exactModuleCacheKey(resolved, exactVersion) {
		if (!resolved.packageRef) return resolved.runtimeURL;
		const { name, version, subpath } = resolved.packageRef;
		return `${name} @${exactVersion ?? version ?? "latest"}${subpath ? `/${subpath}` : ""}${this.#meaningfulRuntimeQuery(resolved.runtimeURL)}`;
	}
	#meaningfulRuntimeQuery(runtimeURL) {
		const url = new this.libs.URL(runtimeURL);
		const ignored = /* @__PURE__ */ new Set(["standalone"]);
		const entries = Array.from(url.searchParams).filter(([key]) => !ignored.has(key)).sort(([left], [right]) => left.localeCompare(right));
		if (!entries.length) return "";
		const params = new URLSearchParams();
		for (const [key, value] of entries) params.append(key, value);
		return `${params} `;
	}
	#cacheableModuleSourceURL(resolved) {
		const url = new this.libs.URL(resolved.runtimeURL);
		if (url.hostname === "esm.sh" || url.hostname.endsWith(".esm.sh")) {
			if (!url.searchParams.has("standalone")) url.searchParams.set("standalone", "");
		}
		return url.href;
	}
	#inferExactModuleVersion(resolved, response, source) {
		const packageRef = resolved.packageRef;
		if (!packageRef) return;
		if (isExactVersion(packageRef.version)) return packageRef.version;
		const candidates = [
			response.url,
			resolved.runtimeURL,
			getHeader(response.headers, "x-esm-path"),
			getHeader(response.headers, "x-typescript-types"),
			source.slice(0, 8192)
		].filter(Boolean).join("\n");
		const escapedName = escapeRegExp$1(packageRef.name);
		return candidates.match(new RegExp(`${escapedName} @(${SEMVER_SOURCE})`, "i"))?.[1] ?? packageRef.version;
	}
	async #importCachedModuleSource(record) {
		const annotatedSource = `${rewriteModuleSpecifiers(record.source, record.sourceURL, this.cdnBaseURL.href, this.libs.URL)}\n;//# sourceURL=${record.sourceURL}\n`;
		const BlobImpl = this.persistentModuleCache?.Blob;
		const URLImpl = this.libs.URL;
		let blobError;
		if (BlobImpl && typeof URLImpl.createObjectURL === "function") {
			const blob = new BlobImpl([annotatedSource], { type: "text/javascript" });
			const blobURL = URLImpl.createObjectURL(blob);
			try {
				return await this.libs.importModule(blobURL);
			} catch (error) {
				blobError = error;
			} finally {
				URLImpl.revokeObjectURL?.(blobURL);
			}
		}
		const dataURL = `data:text/javascript;charset=utf-8,${encodeURIComponent(annotatedSource)}`;
		try {
			return await this.libs.importModule(dataURL);
		} catch (dataError) {
			if (blobError) dataError.cause ??= blobError;
			throw dataError;
		}
	}
	#normalizeBaseURL(value) {
		const URLImpl = this.libs.URL;
		if (value) {
			if (this.#isOSAbsolutePath(String(value))) return this.#fileURLFromPath(String(value));
			return new URLImpl(String(value));
		}
		if (this.mode === "nodenext") {
			const cwd = this.libs.cwd?.();
			if (!cwd) throw new TypeError("nodenext mode requires projectBaseURL or libs.cwd");
			if (!this.libs.pathToFileURL) throw new TypeError("nodenext mode requires libs.pathToFileURL when projectBaseURL is omitted");
			const source = String(cwd);
			const separator = source.includes("\\") ? "\\" : "/";
			const directory = /[\\/]$/.test(source, `${source ? source : separator} `);
			return this.#fileURLFromPath(directory);
		}
		return new URLImpl(globalThis.document?.baseURI ?? globalThis.location?.href ?? "file:///");
	}
	#asDirectoryURL(value) {
		const url = value instanceof this.libs.URL ? new this.libs.URL(value.href) : new this.libs.URL(String(value), this.projectBaseURL);
		if (!url.pathname.endsWith("/")) {
			url.pathname = url.pathname.replace(/[^/]*$/, "");
			url.search = "";
			url.hash = "";
		}
		return url;
	}
	async #resolveUncached(specifier, parent) {
		const URLImpl = this.libs.URL;
		const parentURL = this.#parentURL(parent);
		if (specifier.startsWith("cdn:")) {
			const raw = specifier.slice(4);
			const packageRef = this.parsePackageReference(raw);
			return this.#resolution({
				original: specifier,
				kind: "cdn",
				runtimeURL: new URLImpl(raw, this.cdnBaseURL).href,
				packageRef,
				parentURL: parentURL.href
			});
		}
		if (specifier.startsWith("npm:")) return this.#resolveNpm(specifier, specifier.slice(4), parentURL);
		if (this.#isOSAbsolutePath(specifier)) {
			const fileURL = this.#fileURLFromPath(specifier);
			return this.#resolution({
				original: specifier,
				kind: "local-file",
				runtimeURL: fileURL.href,
				packageRef: null,
				parentURL: parentURL.href
			});
		}
		if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(specifier)) {
			const url = new URLImpl(specifier);
			return this.#resolution({
				original: specifier,
				kind: this.#isLocalURL(url) ? "local-url" : "url",
				runtimeURL: url.href,
				packageRef: this.#inferPackageFromURL(url),
				parentURL: parentURL.href
			});
		}
		if (specifier.startsWith(".") || specifier.startsWith("/")) {
			const url = new URLImpl(specifier, parentURL);
			return this.#resolution({
				original: specifier,
				kind: this.#isLocalURL(url) ? "local-url" : "url",
				runtimeURL: url.href,
				packageRef: null,
				parentURL: parentURL.href
			});
		}
		return this.#resolveNpm(specifier, specifier, parentURL);
	}
	async #resolveNpm(original, raw, parentURL) {
		const packageRef = this.parsePackageReference(raw);
		const local = this.mode === "standaloneScript" ? null : await this.#resolveLocalPackageRuntime(packageRef, parentURL);
		if (local) return this.#resolution({
			original,
			kind: "npm-local",
			runtimeURL: local.runtimeURL,
			packageRef,
			installedVersion: local.packageJson?.version,
			localPackageRoot: local.packageRoot?.href,
			localPackageJson: local.packageJson,
			parentURL: parentURL.href
		});
		if (!this.allowCdnFallback) {
			const error = /* @__PURE__ */ new Error(`Cannot find package ${JSON.stringify(packageRef.name)} from ${parentURL.href}`);
			error.code = "ERR_MODULE_NOT_FOUND";
			error.packageName = packageRef.name;
			throw error;
		}
		return this.#resolution({
			original,
			kind: "npm-cdn",
			runtimeURL: new this.libs.URL(raw, this.cdnBaseURL).href,
			packageRef,
			parentURL: parentURL.href
		});
	}
	#resolution(data) {
		const packageKey = data.packageRef ? `${data.packageRef.name} @${data.packageRef.version ?? data.installedVersion ?? "*"}${data.packageRef.subpath ? `/${data.packageRef.subpath}` : ""}` : data.runtimeURL;
		return Object.freeze({
			...data,
			typeCacheKey: [
				this.mode,
				data.runtimeURL,
				data.localPackageRoot ?? "",
				this.packageFilesBaseURL.href,
				packageKey
			].join("|")
		});
	}
	async #resolveLocalPackageRuntime(ref, parentURL) {
		if (!this.nodeModulesBaseURL) return null;
		const roots = this.mode === "nodenext" ? this.#nodeModulesSearchRoots(parentURL) : [this.nodeModulesBaseURL];
		for (const nodeModulesRoot of roots) {
			const packageRoot = new this.libs.URL(`${ref.name}/`, nodeModulesRoot);
			const packageJsonURL = new this.libs.URL("package.json", packageRoot);
			const packageJson = await this.json(packageJsonURL, { optional: true }).catch(() => void 0);
			if (!packageJson) continue;
			const conditions = this.mode === "nodenext" ? [
				"node",
				"import",
				"default",
				"require"
			] : [
				"browser",
				"import",
				"module",
				"default",
				"require"
			];
			const exported = resolvePackageExport(packageJson.exports, ref.subpath, conditions);
			if (packageJson.exports != null && exported === void 0) {
				const error = /* @__PURE__ */ new Error(`Package subpath ${JSON.stringify(ref.subpath ? `./${ref.subpath}` : ".")} is not defined by "exports" in ${packageJsonURL.href}`);
				error.code = "ERR_PACKAGE_PATH_NOT_EXPORTED";
				throw error;
			}
			const entry = exported ?? (ref.subpath || void 0) ?? (this.mode !== "nodenext" && typeof packageJson.browser === "string" ? packageJson.browser : void 0) ?? packageJson.module ?? packageJson.main ?? "index.js";
			return {
				runtimeURL: new this.libs.URL(String(entry).replace(/^\.\//, ""), packageRoot).href,
				packageRoot,
				packageJson
			};
		}
		return null;
	}
	#nodeModulesSearchRoots(parentURL) {
		const results = [];
		const seen = /* @__PURE__ */ new Set();
		const add = (url) => {
			if (!seen.has(url.href)) {
				seen.add(url.href);
				results.push(url);
			}
		};
		if (this.nodeModulesBaseURL) add(new this.libs.URL(this.nodeModulesBaseURL.href));
		let directory = this.#asDirectoryURL(parentURL);
		while (true) {
			add(new this.libs.URL("node_modules/", directory));
			const parent = new this.libs.URL("../", directory);
			if (parent.href === directory.href) break;
			directory = parent;
		}
		return results;
	}
	async #loadTypesUncached(resolved) {
		const files = /* @__PURE__ */ new Map();
		const packages = /* @__PURE__ */ new Map();
		const seenEntries = /* @__PURE__ */ new Set();
		let entry;
		let source;
		const headerEntry = /^https?:/.test(resolved.runtimeURL) ? await this.#typescriptTypesHeader(resolved.runtimeURL) : void 0;
		if (headerEntry) {
			entry = headerEntry;
			source = "x-typescript-types";
			await this.#collectDeclarationGraph(entry, files, packages, seenEntries, 0);
		} else if (resolved.packageRef) {
			const result = await this.#collectPackageTypes(resolved.packageRef, files, packages, seenEntries, 0, resolved);
			entry = result?.entry;
			source = result?.source;
		} else {
			const localEntry = await this.#findLocalTypeEntry(resolved.runtimeURL);
			if (localEntry) {
				entry = localEntry;
				source = "local";
				await this.#collectDeclarationGraph(entry, files, packages, seenEntries, 0);
			}
		}
		return {
			entry,
			source: source ?? "none",
			files,
			packages,
			found: Boolean(entry),
			getFile: (url) => files.get(this.#toURL(url).href),
			toObject: () => Object.fromEntries(files)
		};
	}
	async #collectPackageTypes(ref, files, packages, seenEntries, depth, resolutionHint = {}) {
		if (depth > this.maxTypeDepth) return null;
		const parentKey = resolutionHint.localPackageRoot ?? resolutionHint.parentURL ?? resolutionHint.runtimeURL ?? "";
		const key = `${ref.name}@${ref.version ?? "*"}${ref.subpath ? `/${ref.subpath}` : ""}|from:${parentKey}`;
		if (packages.has(key)) return await packages.get(key);
		const entryPromise = this.#resolvePackageTypeEntry(ref, resolutionHint);
		packages.set(key, entryPromise);
		const info = await entryPromise;
		packages.set(key, info);
		if (!info?.entry) return null;
		await this.#collectDeclarationGraph(info.entry, files, packages, seenEntries, depth);
		return info;
	}
	async #resolvePackageTypeEntry(ref, resolutionHint = {}) {
		const roots = [];
		if (resolutionHint.localPackageRoot && resolutionHint.localPackageJson) roots.push({
			root: new this.libs.URL(resolutionHint.localPackageRoot),
			pkg: resolutionHint.localPackageJson,
			source: "local-package"
		});
		else if (this.nodeModulesBaseURL && this.mode !== "standaloneScript") {
			const from = resolutionHint.parentURL ?? resolutionHint.runtimeURL ?? this.projectBaseURL.href;
			for (const nodeModulesRoot of this.#nodeModulesSearchRoots(from)) {
				const localRoot = new this.libs.URL(`${ref.name}/`, nodeModulesRoot);
				const localPkg = await this.json(new this.libs.URL("package.json", localRoot), { optional: true }).catch(() => void 0);
				if (localPkg) {
					roots.push({
						root: localRoot,
						pkg: localPkg,
						source: "local-package"
					});
					break;
				}
			}
		}
		if (this.allowCdnFallback) {
			const remoteRoot = new this.libs.URL(`${ref.name}${ref.version ? `@${ref.version}` : ""}/`, this.packageFilesBaseURL);
			const remotePkg = await this.json(new this.libs.URL("package.json", remoteRoot), { optional: true }).catch(() => void 0);
			if (remotePkg) roots.push({
				root: remoteRoot,
				pkg: remotePkg,
				source: "package-cdn"
			});
		}
		const direct = await this.#firstPackageTypeCandidate(ref, roots);
		if (direct) return direct;
		const typesName = definitelyTypedName(ref.name);
		if (typesName === ref.name) return null;
		const typesRef = {
			name: typesName,
			version: void 0,
			subpath: ref.subpath
		};
		const typesRoots = [];
		if (this.nodeModulesBaseURL && this.mode !== "standaloneScript") {
			const from = resolutionHint.parentURL ?? resolutionHint.runtimeURL ?? this.projectBaseURL.href;
			for (const nodeModulesRoot of this.#nodeModulesSearchRoots(from)) {
				const localRoot = new this.libs.URL(`${typesName}/`, nodeModulesRoot);
				const localPkg = await this.json(new this.libs.URL("package.json", localRoot), { optional: true }).catch(() => void 0);
				if (localPkg) {
					typesRoots.push({
						root: localRoot,
						pkg: localPkg,
						source: "local-definitely-typed"
					});
					break;
				}
			}
		}
		if (this.allowCdnFallback) {
			const remoteRoot = new this.libs.URL(`${typesName}/`, this.packageFilesBaseURL);
			const remotePkg = await this.json(new this.libs.URL("package.json", remoteRoot), { optional: true }).catch(() => void 0);
			if (remotePkg) typesRoots.push({
				root: remoteRoot,
				pkg: remotePkg,
				source: "definitely-typed"
			});
		}
		return this.#firstPackageTypeCandidate(typesRef, typesRoots);
	}
	async #firstPackageTypeCandidate(ref, roots) {
		for (const candidate of roots) {
			const typePath = chooseTypeEntry(candidate.pkg, ref.subpath);
			if (!typePath) continue;
			const entry = await this.#firstReadableDeclaration(declarationCandidates$1(new this.libs.URL(typePath.replace(/^\.\//, ""), candidate.root)));
			if (entry) return {
				entry,
				source: candidate.source,
				packageName: ref.name,
				version: candidate.pkg.version ?? ref.version
			};
		}
		return null;
	}
	async #collectDeclarationGraph(entryURL, files, packages, seenEntries, depth) {
		if (depth > this.maxTypeDepth) return;
		const href = this.#toURL(entryURL).href;
		if (seenEntries.has(href)) return;
		if (seenEntries.size >= this.maxTypeFiles) {
			const error = /* @__PURE__ */ new RangeError(`Type graph exceeded the maximum of ${this.maxTypeFiles} files while loading ${href}`);
			error.code = "ERR_TYPE_GRAPH_LIMIT";
			throw error;
		}
		seenEntries.add(href);
		const declarationSource = await this.text(href, { optional: true });
		if (declarationSource === void 0) return;
		files.set(href, declarationSource);
		await runWithConcurrency(parseDeclarationDependencies(declarationSource).map((dependency) => async () => {
			try {
				if (dependency.kind === "path") {
					const child = await this.#firstReadableDeclaration(declarationCandidates$1(new this.libs.URL(dependency.value, href)));
					if (child) await this.#collectDeclarationGraph(child, files, packages, seenEntries, depth + 1);
					return;
				}
				const ref = dependency.kind === "types" ? {
					name: definitelyTypedName(dependency.value),
					version: void 0,
					subpath: ""
				} : this.parsePackageReference(dependency.value);
				await this.#collectPackageTypes(ref, files, packages, seenEntries, depth + 1, { parentURL: href });
			} catch (error) {
				if (error?.code === "ERR_TYPE_GRAPH_LIMIT") throw error;
				this.onError?.(error);
			}
		}), this.typeConcurrency);
	}
	async #typescriptTypesHeader(runtimeURL) {
		if (!this.libs.fetch) return;
		try {
			const response = await this.libs.fetch(String(runtimeURL), { method: "GET" });
			if (!response?.ok) return;
			const value = getHeader(response.headers, "x-typescript-types");
			return value ? new this.libs.URL(value, response.url || runtimeURL).href : void 0;
		} catch {
			return;
		}
	}
	async #findLocalTypeEntry(runtimeURL) {
		return this.#firstReadableDeclaration(declarationCandidates$1(this.#toURL(runtimeURL)));
	}
	async #firstReadableDeclaration(candidates) {
		for (const candidate of candidates) if (await this.text(candidate, { optional: true }) !== void 0) return this.#toURL(candidate).href;
	}
	async #registerMonaco(resolved, bundle) {
		const { monaco, MonacoAutoTypings, editor } = this.libs;
		if (!bundle.found) return;
		if (resolved.packageRef) {
			this.#setMonacoAlias(resolved.original, resolved.packageRef);
			await this.#preloadMonacoPackage(resolved.packageRef);
			return;
		}
		for (const [url, source] of bundle.files) {
			const uri = monaco.Uri.parse(url);
			if (!monaco.editor.getModel(uri)) {
				const model = monaco.editor.createModel(source, "typescript", uri);
				this.monacoModels.set(url, model);
			}
		}
	}
	#setMonacoAlias(specifier, ref) {
		const { monaco } = this.libs;
		const target = `${ref.name}${ref.subpath ? `/${ref.subpath}` : ""}`;
		this.monacoAliases[specifier] = [`node_modules/${target}`];
		for (const defaults of [monaco.languages.typescript.typescriptDefaults, monaco.languages.typescript.javascriptDefaults]) {
			const current = defaults.getCompilerOptions();
			defaults.setCompilerOptions({
				...current,
				moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
				baseUrl: current.baseUrl ?? this.monacoOptions.fileRoot,
				paths: {
					...current.paths ?? {},
					...this.monacoAliases
				}
			});
		}
	}
	async #preloadMonacoPackage(ref) {
		const { monaco, MonacoAutoTypings } = this.libs;
		const canonical = `${ref.name}${ref.subpath ? `/${ref.subpath}` : ""}`;
		const key = `${ref.name}@${ref.version ?? "*"}:${ref.subpath}`;
		if (this.monacoLoaders.has(key)) return this.monacoLoaders.get(key);
		const uri = monaco.Uri.parse(`${this.monacoOptions.fileRoot}__auto_typings__/${encodeURIComponent(key)}.ts`);
		const model = monaco.editor.createModel(`import ${JSON.stringify(canonical)};`, "typescript", uri);
		const adapter = {
			getModel: () => model,
			onDidChangeModelContent: (listener) => model.onDidChangeContent(listener),
			getPosition: () => null,
			setPosition: () => {}
		};
		const sourceResolver = this.monacoOptions.sourceResolver ?? createMonacoSourceResolver({
			fetch: this.libs.fetch,
			URL: this.libs.URL,
			nodeModulesBaseURL: this.nodeModulesBaseURL,
			packageFilesBaseURL: this.packageFilesBaseURL,
			readTextFile: this.libs.readTextFile
		});
		const promise = MonacoAutoTypings.create(adapter, {
			monaco,
			fileRootPath: this.monacoOptions.fileRoot,
			debounceDuration: 0,
			sourceResolver,
			...this.monacoOptions.sourceCache ? { sourceCache: this.monacoOptions.sourceCache } : {},
			...ref.version ? { versions: { [ref.name]: ref.version } } : {},
			onError: (error) => this.onError?.(error)
		}).then((loader) => ({
			loader,
			model
		}));
		this.monacoLoaders.set(key, promise);
		promise.catch(() => {
			this.monacoLoaders.delete(key);
			model.dispose?.();
		});
		return promise;
	}
	#parentURL(parent) {
		if (parent instanceof this.libs.URL) return parent;
		const value = String(parent);
		if (this.#isOSAbsolutePath(value)) return this.#fileURLFromPath(value);
		return new this.libs.URL(value, this.projectBaseURL);
	}
	#toURL(value) {
		if (value instanceof this.libs.URL) return value;
		const string = String(value);
		if (this.#isOSAbsolutePath(string)) return this.#fileURLFromPath(string);
		return new this.libs.URL(string, this.projectBaseURL);
	}
	#isLocalURL(url) {
		return url.protocol === "file:" || this.projectBaseURL.protocol !== "file:" && url.origin === this.projectBaseURL.origin;
	}
	#isOSAbsolutePath(value) {
		return /^[A-Za-z]:[\\/]/.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value);
	}
	#fileURLFromPath(path) {
		if (!this.libs.pathToFileURL) throw new TypeError(`Cannot resolve filesystem path without libs.pathToFileURL: ${path}`);
		const value = this.libs.pathToFileURL(path);
		return value instanceof this.libs.URL ? value : new this.libs.URL(String(value));
	}
	async #readURLText(href, optional) {
		const url = new this.libs.URL(href);
		if (url.protocol === "file:") {
			if (!this.libs.readTextFile) {
				if (optional) return;
				throw new TypeError(`libs.readTextFile is required to read ${href}`);
			}
			try {
				return await this.libs.readTextFile(url);
			} catch (error) {
				if (optional) return;
				throw error;
			}
		}
		if (!this.libs.fetch) {
			if (optional) return;
			throw new TypeError(`libs.fetch is required to read ${href}`);
		}
		try {
			const response = await this.libs.fetch(href, { method: "GET" });
			if (response?.ok) return await response.text();
			if (optional || response?.status === 404) return;
			throw new Error(`Failed to fetch ${href}: ${response?.status ?? "unknown"} ${response?.statusText ?? ""}`.trim());
		} catch (error) {
			if (optional) return;
			throw error;
		}
	}
	#inferPackageFromURL(url) {
		const host = url.hostname.toLowerCase();
		let parts = url.pathname.split("/").filter(Boolean);
		if (host === "cdn.jsdelivr.net" && parts[0] === "npm") parts = parts.slice(1);
		else if (host === "esm.sh" || host.endsWith(".esm.sh")) {
			if (/^v\d+$/.test(parts[0] || "")) parts = parts.slice(1);
		} else if (host !== "unpkg.com") return null;
		if (!parts.length) return null;
		const scoped = parts[0].startsWith("@");
		const head = scoped ? `${parts[0]}/${parts[1] || ""}` : parts[0];
		const consumed = scoped ? 2 : 1;
		const parsed = this.parsePackageReference(head);
		parsed.subpath = parts.slice(consumed).join("/");
		return parsed;
	}
};
/**
* Internal SourceResolver adapter compatible with
* monaco-editor-auto-typings.
*/
function createMonacoSourceResolver({ fetch = globalThis.fetch?.bind(globalThis), URL: URLImpl = globalThis.URL, readTextFile, nodeModulesBaseURL = null, packageFilesBaseURL = "https://cdn.jsdelivr.net/npm/" } = {}) {
	if (!URLImpl) throw new TypeError("URL implementation is required");
	const remoteBase = new URLImpl(String(packageFilesBaseURL));
	const localBase = nodeModulesBaseURL ? new URLImpl(String(nodeModulesBaseURL), remoteBase) : null;
	const read = async (url, optional = false) => {
		const target = url instanceof URLImpl ? url : new URLImpl(String(url));
		if (target.protocol === "file:") {
			if (!readTextFile) {
				if (optional) return;
				throw new TypeError(`readTextFile is required for ${target.href}`);
			}
			try {
				return await readTextFile(target);
			} catch (error) {
				if (optional) return;
				throw error;
			}
		}
		if (!fetch) {
			if (optional) return;
			throw new TypeError(`fetch is required for ${target.href}`);
		}
		try {
			const response = await fetch(target.href, { method: "GET" });
			if (response?.ok) return await response.text();
			if (optional || response?.status === 404) return;
			throw new Error(`Failed to fetch ${target.href}: ${response?.status ?? "unknown"}`);
		} catch (error) {
			if (optional) return;
			throw error;
		}
	};
	const packageFileURL = (base, name, version, filePath) => new URLImpl(`${name}${version ? `@${version}` : ""}/${String(filePath).replace(/^\/+/, "")}`, base);
	const resolve = async (name, version, filePath) => {
		if (localBase) {
			const local = await read(packageFileURL(localBase, name, void 0, filePath), true);
			if (local !== void 0) return local;
		}
		return read(packageFileURL(remoteBase, name, version, filePath), true);
	};
	return {
		resolvePackageJson(name, version, subPath) {
			const prefix = subPath ? `${String(subPath).replace(/^\/+|\/+$/g, "")}/` : "";
			return resolve(name, version, `${prefix}package.json`);
		},
		resolveSourceFile(name, version, filePath) {
			return resolve(name, version, filePath);
		}
	};
}
function createMemoryCache() {
	return {
		resolutions: /* @__PURE__ */ new Map(),
		text: /* @__PURE__ */ new Map(),
		json: /* @__PURE__ */ new Map(),
		types: /* @__PURE__ */ new Map(),
		modules: /* @__PURE__ */ new Map()
	};
}
function normalizeMemoryCache(cache) {
	const normalized = cache ?? createMemoryCache();
	for (const key of [
		"resolutions",
		"text",
		"json",
		"types",
		"modules"
	]) normalized[key] ??= /* @__PURE__ */ new Map();
	return normalized;
}
function toPositiveInteger(value, name) {
	const number = Number(value);
	if (!Number.isFinite(number) || number < 1) throw new TypeError(`${name} must be a positive finite number`);
	return Math.floor(number);
}
const SEMVER_SOURCE = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?`;
function detectCurrentBaseId() {
	try {
		if (typeof base !== "undefined" && base?.id) return base.id;
	} catch {}
	return globalThis.base?.id;
}
function normalizeCacheCycleLength(value) {
	const candidate = value ?? {
		value: 24,
		unit: "hours"
	};
	const amount = Number(candidate.value);
	const rawUnit = String(candidate.unit ?? "hours").trim().toLowerCase();
	if (!Number.isFinite(amount) || amount <= 0) throw new TypeError("cacheCycleLength.value must be a positive finite number");
	const unit = {
		ms: "milliseconds",
		millisecond: "milliseconds",
		milliseconds: "milliseconds",
		second: "seconds",
		seconds: "seconds",
		minute: "minutes",
		minutes: "minutes",
		hour: "hours",
		hours: "hours",
		day: "days",
		days: "days",
		week: "weeks",
		weeks: "weeks"
	}[rawUnit];
	if (!unit) throw new TypeError(`Unsupported cacheCycleLength unit: ${candidate.unit}`);
	return {
		value: amount,
		unit
	};
}
function cacheCycleToMilliseconds({ value, unit }) {
	return value * {
		milliseconds: 1,
		seconds: 1e3,
		minutes: 6e4,
		hours: 36e5,
		days: 864e5,
		weeks: 6048e5
	}[unit];
}
function isExactVersion(value) {
	return Boolean(value) && new RegExp(`^${SEMVER_SOURCE}$`, "i").test(String(value));
}
function escapeRegExp$1(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function getHeader(headers, name) {
	if (!headers) return;
	if (typeof headers.get === "function") return headers.get(name) ?? headers.get(name.toLowerCase()) ?? void 0;
	const target = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === target) return value;
}
/**
* Convert relative, root-relative, and bare imports in cached source to
* absolute URLs.
*/
function rewriteModuleSpecifiers(source, sourceURL, cdnBaseURL, URLImpl) {
	const rewrite = (specifier) => {
		if (!specifier || specifier.startsWith("node:") || specifier.startsWith("data:") || specifier.startsWith("blob:")) return specifier;
		if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(specifier)) return specifier;
		if (specifier.startsWith(".") || specifier.startsWith("/")) return new URLImpl(specifier, sourceURL).href;
		return new URLImpl(specifier, cdnBaseURL).href;
	};
	let result = String(source);
	result = result.replace(/(\b(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\s+from\s*)?)(["'])([^"']+)\2/g, (full, prefix, quote, specifier) => `${prefix}${quote}${rewrite(specifier)}${quote}`);
	result = result.replace(/(\bimport\s*\(\s*)(["'])([^"']+)\2(\s*\))/g, (full, prefix, quote, specifier, suffix) => `${prefix}${quote}${rewrite(specifier)}${quote}${suffix}`);
	return result;
}
function definitelyTypedName(packageName) {
	if (packageName.startsWith("@types/")) return packageName;
	if (packageName.startsWith("@")) return `@types/${packageName.slice(1).replace("/", "__")}`;
	return `@types/${packageName}`;
}
/**
* Resolve package.json exports, including exact and single-star subpaths.
*/
function resolvePackageExport(exportsField, subpath, conditions) {
	if (exportsField == null) return;
	const key = subpath ? `./${subpath}` : ".";
	let target;
	let wildcard;
	if (typeof exportsField === "string" || Array.isArray(exportsField)) target = key === "." ? exportsField : void 0;
	else if (typeof exportsField === "object") {
		const keys = Object.keys(exportsField);
		if (!keys.some((item) => item.startsWith("."))) target = key === "." ? exportsField : void 0;
		else if (Object.hasOwn(exportsField, key)) target = exportsField[key];
		else for (const pattern of keys) {
			if (!pattern.includes("*")) continue;
			const [prefix, suffix] = pattern.split("*");
			if (key.startsWith(prefix) && key.endsWith(suffix)) {
				wildcard = key.slice(prefix.length, key.length - suffix.length);
				target = exportsField[pattern];
				break;
			}
		}
	}
	const result = unwrapConditionalExport(target, conditions);
	return typeof result === "string" && wildcard !== void 0 ? result.replaceAll("*", wildcard) : result;
}
function unwrapConditionalExport(target, conditions) {
	if (typeof target === "string") return target;
	if (Array.isArray(target)) {
		for (const item of target) {
			const value = unwrapConditionalExport(item, conditions);
			if (value) return value;
		}
		return;
	}
	if (!target || typeof target !== "object") return;
	for (const condition of conditions) {
		const value = unwrapConditionalExport(target[condition], conditions);
		if (value) return value;
	}
	for (const value of Object.values(target)) {
		const unwrapped = unwrapConditionalExport(value, conditions);
		if (unwrapped) return unwrapped;
	}
}
function chooseTypeEntry(pkg, subpath) {
	const exportType = resolvePackageExport(pkg.exports, subpath, [
		"types",
		"typings",
		"import",
		"default",
		"node",
		"browser",
		"require"
	]);
	if (exportType) return toDeclarationPath(exportType);
	if (subpath) return subpath;
	return pkg.types ?? pkg.typings ?? "index.d.ts";
}
function toDeclarationPath(path) {
	const value = String(path);
	if (/\.d\.(?:ts|mts|cts)$/i.test(value)) return value;
	if (/\.mjs$/i.test(value)) return value.replace(/\.mjs$/i, ".d.mts");
	if (/\.cjs$/i.test(value)) return value.replace(/\.cjs$/i, ".d.cts");
	if (/\.(?:js|jsx|mts|cts|ts|tsx)$/i.test(value)) return value.replace(/\.(?:js|jsx|mts|cts|ts|tsx)$/i, ".d.ts");
	return value;
}
function declarationCandidates$1(url) {
	const URLImpl = url.constructor;
	const candidates = [];
	const push = (value) => {
		const candidate = value instanceof URLImpl ? value : new URLImpl(value);
		if (!candidates.some((existing) => existing.href === candidate.href)) candidates.push(candidate);
	};
	const replaceExtension = (extension) => {
		const candidate = new URLImpl(url.href);
		candidate.pathname = candidate.pathname.replace(/\.[^/.]+$/, extension);
		return candidate;
	};
	const appendPath = (suffix) => {
		const candidate = new URLImpl(url.href);
		candidate.pathname = `${candidate.pathname.replace(/\/$/, "")}${suffix}`;
		return candidate;
	};
	const pathname = url.pathname;
	if (/\.d\.(?:ts|mts|cts)$/i.test(pathname) || /\.(?:ts|tsx|mts|cts)$/i.test(pathname)) {
		push(url);
		return candidates;
	}
	if (/\.cjs$/i.test(pathname)) {
		push(replaceExtension(".d.cts"));
		push(replaceExtension(".d.ts"));
		return candidates;
	}
	if (/\.mjs$/i.test(pathname)) {
		push(replaceExtension(".d.mts"));
		push(replaceExtension(".d.ts"));
		return candidates;
	}
	if (/\.(?:js|jsx)$/i.test(pathname)) {
		push(replaceExtension(".d.ts"));
		push(replaceExtension(".d.mts"));
		push(replaceExtension(".d.cts"));
		return candidates;
	}
	push(appendPath(".d.ts"));
	push(appendPath(".d.mts"));
	push(appendPath(".d.cts"));
	push(appendPath("/index.d.ts"));
	push(appendPath("/index.d.mts"));
	push(appendPath("/index.d.cts"));
	return candidates;
}
async function runWithConcurrency(jobs, concurrency = 8) {
	if (!jobs.length) return;
	const limit = Math.max(1, Math.floor(concurrency));
	let nextIndex = 0;
	const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
		while (true) {
			const index = nextIndex++;
			if (index >= jobs.length) return;
			await jobs[index]();
		}
	});
	await Promise.all(workers);
}
function parseDeclarationDependencies(source) {
	const results = [];
	const seen = /* @__PURE__ */ new Set();
	const add = (kind, value) => {
		const key = `${kind}:${value}`;
		if (!value || seen.has(key)) return;
		seen.add(key);
		results.push({
			kind,
			value
		});
	};
	for (const match of source.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^;"']*?\s+from\s*)?["']([^"']+)["']/g)) addModuleDependency(match[1], add);
	for (const match of source.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g)) addModuleDependency(match[1], add);
	for (const match of source.matchAll(/\/\/\/\s*<reference\s+path=["']([^"']+)["'][^>]*>/g)) add("path", match[1]);
	for (const match of source.matchAll(/\/\/\/\s*<reference\s+types=["']([^"']+)["'][^>]*>/g)) add("types", match[1]);
	return results;
}
function addModuleDependency(value, add) {
	if (!value) return;
	if (value.startsWith(".") || value.startsWith("/")) {
		add("path", value);
		return;
	}
	if (value.startsWith("node:")) {
		add("types", "node");
		return;
	}
	add("package", value);
}
var bli_cache_default = { AutoTypings };
//#endregion
//#region src/core/lib/string.ts
var string_exports = /* @__PURE__ */ __exportAll({
	escapeJsString: () => escapeJsString,
	exportTypeAccessor: () => exportTypeAccessor,
	isIdentifierName: () => isIdentifierName,
	propertyAccessor: () => propertyAccessor,
	runtimePropertyAccessor: () => runtimePropertyAccessor,
	sanitizeBindingName: () => sanitizeBindingName
});
function escapeJsString(value) {
	return String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
function isIdentifierName(value) {
	return /^[A-Za-z_$][\w$]*$/.test(value);
}
function sanitizeBindingName(name) {
	if (name === "default") return "defaultExport";
	const value = String(name || "").replace(/[^\w$]/g, "_");
	if (!value) return "value";
	return /^\d/.test(value) ? `_${value}` : value;
}
function propertyAccessor(key) {
	return isIdentifierName(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}
const exportTypeAccessor = propertyAccessor;
const runtimePropertyAccessor = propertyAccessor;
//#endregion
//#region src/core/index.ts
var core_default = { ...string_exports };
//#endregion
//#region src/converter.ts
var converter_exports = /* @__PURE__ */ __exportAll({ createDtsCompletionConverter: () => createDtsCompletionConverter });
/** Create a converter from .d.ts source text to JSON-serializable completion entries. */
function createDtsCompletionConverter(ts) {
	function cleanText(value) {
		return String(value || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
	}
	function cleanOneLine(value) {
		return cleanText(value).replace(/\s+/g, " ").trim();
	}
	function stripDeclareAndExport(value) {
		return cleanOneLine(value.replace(/\bdeclare\s+/g, "").replace(/\bexport\s+/g, "").replace(/\bdefault\s+/g, ""));
	}
	function getPrintedDetail(sourceFile, node) {
		return stripDeclareAndExport(node.getText(sourceFile));
	}
	function getLeadingJsDoc(sourceText, node) {
		const docs = (ts.getLeadingCommentRanges(sourceText, node.pos) || []).map((range) => sourceText.slice(range.pos, range.end)).filter((text) => text.startsWith("/**")).map((text) => {
			return text.replace(/^\/\*\*/, "").replace(/\*\/$/, "").replace(/^\s*\*\s?/gm, "").trim();
		}).filter(Boolean);
		return docs.length ? cleanText(docs.join("\n\n")) : "";
	}
	function nodeNameText(sourceFile, nameNode) {
		if (!nameNode) return "";
		return nameNode.getText(sourceFile).replace(/^["']|["']$/g, "");
	}
	function getTypeText(sourceFile, typeNode) {
		return typeNode ? cleanOneLine(typeNode.getText(sourceFile)) : "";
	}
	function getReturnTypeText(sourceFile, node) {
		return node?.type ? getTypeText(sourceFile, node.type) : "";
	}
	function getParamName(sourceFile, param, index) {
		if (!param?.name) return `arg${index + 1}`;
		if (ts.isIdentifier(param.name)) return param.name.text;
		return `arg${index + 1}`;
	}
	function sanitizeSnippetPlaceholder(value) {
		return String(value || "arg").replace(/[{}$\\]/g, "").replace(/\s+/g, " ").trim();
	}
	function buildFunctionInsertText(sourceFile, name, node) {
		return `${name}(${Array.from(node.parameters || []).map((param, index) => {
			const placeholder = sanitizeSnippetPlaceholder(getParamName(sourceFile, param, index));
			const token = "${" + (index + 1) + ":" + placeholder + "}";
			return param.dotDotDotToken ? `...${token}` : token;
		}).join(", ")})`;
	}
	function buildConstructorInsertText(sourceFile, name, node) {
		return `new ${name}(${Array.from(node.parameters || []).map((param, index) => {
			const placeholder = sanitizeSnippetPlaceholder(getParamName(sourceFile, param, index));
			return "${" + (index + 1) + ":" + placeholder + "}";
		}).join(", ")})`;
	}
	function makeEntry(entry) {
		const { scope = "global", label = "", kind = "Text", insertText, detail = "", documentation = "", type = "", returnType = "", memberOf = "", exportName = "", isStatic = false } = entry;
		return {
			scope,
			label,
			kind,
			insertText: insertText || label,
			detail,
			documentation,
			type,
			returnType,
			memberOf,
			exportName,
			isStatic
		};
	}
	function addEntry(state, entry) {
		if (!entry?.label) return;
		const key = [
			entry.scope,
			entry.kind,
			entry.label,
			entry.detail
		].join("\0");
		if (state.seen.has(key)) return;
		state.seen.add(key);
		state.flat.push(entry);
		(state.byScope[entry.scope] ??= []).push(entry);
	}
	function ensureTypeRecord(state, name, kind, detail) {
		if (!name) return;
		if (!state.types[name]) state.types[name] = {
			kind,
			detail: detail || "",
			members: []
		};
	}
	function addTypeMember(state, typeName, memberEntry) {
		if (!typeName || !memberEntry) return;
		ensureTypeRecord(state, typeName, "Type", "");
		state.types[typeName]?.members.push({ ...memberEntry });
	}
	function handleVariableStatement(sourceFile, sourceText, node, scope, state) {
		const documentation = getLeadingJsDoc(sourceText, node);
		for (const decl of node.declarationList.declarations || []) {
			const label = nodeNameText(sourceFile, decl.name);
			if (!label) continue;
			addEntry(state, makeEntry({
				scope,
				label,
				kind: "Variable",
				insertText: label,
				detail: getPrintedDetail(sourceFile, decl),
				documentation,
				type: getTypeText(sourceFile, decl.type)
			}));
		}
	}
	function handleFunctionLike(sourceFile, sourceText, node, scope, state, forcedName) {
		const label = forcedName || nodeNameText(sourceFile, node.name);
		if (!label) return;
		addEntry(state, makeEntry({
			scope,
			label,
			kind: "Function",
			insertText: buildFunctionInsertText(sourceFile, label, node),
			detail: getPrintedDetail(sourceFile, node),
			documentation: getLeadingJsDoc(sourceText, node),
			returnType: getReturnTypeText(sourceFile, node)
		}));
	}
	function hasStaticModifier(node) {
		return Array.from(node?.modifiers || []).some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword);
	}
	function handlePropertyMember(sourceFile, sourceText, node, scope, state, ownerName, isStatic = false) {
		const label = nodeNameText(sourceFile, node.name);
		if (!label) return;
		const entry = makeEntry({
			scope,
			label,
			kind: "Property",
			insertText: label,
			detail: getPrintedDetail(sourceFile, node),
			documentation: getLeadingJsDoc(sourceText, node),
			type: getTypeText(sourceFile, node.type),
			memberOf: ownerName,
			isStatic
		});
		addEntry(state, entry);
		addTypeMember(state, ownerName, entry);
	}
	function handleMethodMember(sourceFile, sourceText, node, scope, state, ownerName, isStatic = false) {
		const label = nodeNameText(sourceFile, node.name);
		if (!label) return;
		const entry = makeEntry({
			scope,
			label,
			kind: "Method",
			insertText: buildFunctionInsertText(sourceFile, label, node),
			detail: getPrintedDetail(sourceFile, node),
			documentation: getLeadingJsDoc(sourceText, node),
			returnType: getReturnTypeText(sourceFile, node),
			memberOf: ownerName,
			isStatic
		});
		addEntry(state, entry);
		addTypeMember(state, ownerName, entry);
	}
	function handleConstructorMember(sourceFile, sourceText, node, scope, state, ownerName) {
		const entry = makeEntry({
			scope,
			label: "constructor",
			kind: "Constructor",
			insertText: buildConstructorInsertText(sourceFile, ownerName || "", node),
			detail: getPrintedDetail(sourceFile, node),
			documentation: getLeadingJsDoc(sourceText, node),
			memberOf: ownerName
		});
		addEntry(state, entry);
		addTypeMember(state, ownerName, entry);
	}
	function handleIndexSignature(sourceFile, sourceText, node, scope, state, ownerName) {
		const entry = makeEntry({
			scope,
			label: "[index]",
			kind: "Property",
			insertText: "",
			detail: getPrintedDetail(sourceFile, node),
			documentation: getLeadingJsDoc(sourceText, node),
			type: getReturnTypeText(sourceFile, node),
			memberOf: ownerName
		});
		addEntry(state, entry);
		addTypeMember(state, ownerName, entry);
	}
	function handleMembers(sourceFile, sourceText, members, ownerName, state) {
		const scope = `type:${ownerName}`;
		for (const member of members || []) {
			const isStatic = hasStaticModifier(member);
			if (ts.isPropertySignature(member) || ts.isPropertyDeclaration(member)) {
				handlePropertyMember(sourceFile, sourceText, member, scope, state, ownerName, isStatic);
				continue;
			}
			if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) {
				handleMethodMember(sourceFile, sourceText, member, scope, state, ownerName, isStatic);
				continue;
			}
			if (ts.isConstructorDeclaration(member) || ts.isConstructSignatureDeclaration(member)) {
				handleConstructorMember(sourceFile, sourceText, member, scope, state, ownerName);
				continue;
			}
			if (ts.isIndexSignatureDeclaration(member)) {
				handleIndexSignature(sourceFile, sourceText, member, scope, state, ownerName);
				continue;
			}
			if (ts.isCallSignatureDeclaration(member)) {
				const entry = makeEntry({
					scope,
					label: "(call)",
					kind: "Function",
					insertText: buildFunctionInsertText(sourceFile, "", member).replace(/^\(/, "("),
					detail: getPrintedDetail(sourceFile, member),
					documentation: getLeadingJsDoc(sourceText, member),
					returnType: getReturnTypeText(sourceFile, member),
					memberOf: ownerName
				});
				addEntry(state, entry);
				addTypeMember(state, ownerName, entry);
			}
		}
	}
	function handleInterface(sourceFile, sourceText, node, scope, state) {
		const label = nodeNameText(sourceFile, node.name);
		if (!label) return;
		const detail = getPrintedDetail(sourceFile, node);
		ensureTypeRecord(state, label, "Interface", detail);
		addEntry(state, makeEntry({
			scope,
			label,
			kind: "Interface",
			insertText: label,
			detail,
			documentation: getLeadingJsDoc(sourceText, node)
		}));
		handleMembers(sourceFile, sourceText, node.members, label, state);
	}
	function handleClass(sourceFile, sourceText, node, scope, state) {
		const label = nodeNameText(sourceFile, node.name);
		if (!label) return;
		const detail = getPrintedDetail(sourceFile, node);
		ensureTypeRecord(state, label, "Class", detail);
		addEntry(state, makeEntry({
			scope,
			label,
			kind: "Class",
			insertText: label,
			detail,
			documentation: getLeadingJsDoc(sourceText, node)
		}));
		handleMembers(sourceFile, sourceText, node.members, label, state);
	}
	function handleTypeAlias(sourceFile, sourceText, node, scope, state) {
		const label = nodeNameText(sourceFile, node.name);
		if (!label) return;
		const detail = getPrintedDetail(sourceFile, node);
		ensureTypeRecord(state, label, "TypeAlias", detail);
		addEntry(state, makeEntry({
			scope,
			label,
			kind: "TypeAlias",
			insertText: label,
			detail,
			documentation: getLeadingJsDoc(sourceText, node),
			type: getTypeText(sourceFile, node.type)
		}));
	}
	function handleEnum(sourceFile, sourceText, node, scope, state) {
		const label = nodeNameText(sourceFile, node.name);
		if (!label) return;
		const detail = getPrintedDetail(sourceFile, node);
		const enumScope = `type:${label}`;
		ensureTypeRecord(state, label, "Enum", detail);
		addEntry(state, makeEntry({
			scope,
			label,
			kind: "Enum",
			insertText: label,
			detail,
			documentation: getLeadingJsDoc(sourceText, node)
		}));
		for (const member of node.members || []) {
			const memberLabel = nodeNameText(sourceFile, member.name);
			if (!memberLabel) continue;
			const entry = makeEntry({
				scope: enumScope,
				label: memberLabel,
				kind: "EnumMember",
				insertText: memberLabel,
				detail: getPrintedDetail(sourceFile, member),
				documentation: getLeadingJsDoc(sourceText, member),
				memberOf: label
			});
			addEntry(state, entry);
			addTypeMember(state, label, entry);
		}
	}
	function moduleNameFromNode(sourceFile, node) {
		if (!node?.name) return "module";
		return node.name.getText(sourceFile).replace(/^["']|["']$/g, "");
	}
	function walk(sourceFile, sourceText, node, scope, state) {
		if (ts.isModuleDeclaration(node)) {
			const name = moduleNameFromNode(sourceFile, node);
			const nextScope = node.flags & ts.NodeFlags.Namespace ? `namespace:${name}` : `module:${name}`;
			if (node.body) walk(sourceFile, sourceText, node.body, nextScope, state);
			return;
		}
		if (ts.isModuleBlock(node)) {
			for (const statement of node.statements || []) walk(sourceFile, sourceText, statement, scope, state);
			return;
		}
		if (ts.isVariableStatement(node)) return handleVariableStatement(sourceFile, sourceText, node, scope, state);
		if (ts.isFunctionDeclaration(node)) return handleFunctionLike(sourceFile, sourceText, node, scope, state);
		if (ts.isInterfaceDeclaration(node)) return handleInterface(sourceFile, sourceText, node, scope, state);
		if (ts.isClassDeclaration(node)) return handleClass(sourceFile, sourceText, node, scope, state);
		if (ts.isTypeAliasDeclaration(node)) return handleTypeAlias(sourceFile, sourceText, node, scope, state);
		if (ts.isEnumDeclaration(node)) return handleEnum(sourceFile, sourceText, node, scope, state);
		if (ts.isExportAssignment(node)) {
			const label = node.expression.getText(sourceFile);
			addEntry(state, makeEntry({
				scope,
				label,
				kind: "Export",
				insertText: label,
				detail: getPrintedDetail(sourceFile, node),
				documentation: getLeadingJsDoc(sourceText, node),
				exportName: label
			}));
			return;
		}
		ts.forEachChild(node, (child) => walk(sourceFile, sourceText, child, scope, state));
	}
	function convertText(dtsText, options = {}) {
		const fileName = options.fileName || "virtual.d.ts";
		const sourceText = String(dtsText || "");
		const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const state = {
			flat: [],
			byScope: {},
			types: {},
			seen: /* @__PURE__ */ new Set()
		};
		walk(sourceFile, sourceText, sourceFile, "global", state);
		return {
			flat: state.flat,
			byScope: state.byScope,
			types: state.types
		};
	}
	return { convertText };
}
//#endregion
//#region src/github.ts
var github_exports = /* @__PURE__ */ __exportAll({
	DEFAULT_OCTOKIT_URL: () => DEFAULT_OCTOKIT_URL,
	PRIVATE_GITHUB_PROTOCOL: () => PRIVATE_GITHUB_PROTOCOL,
	createGitHubVirtualUrl: () => createGitHubVirtualUrl,
	fetchGitHubFile: () => fetchGitHubFile,
	fetchGitHubVirtualText: () => fetchGitHubVirtualText,
	hasPrivateGitHubTransport: () => hasPrivateGitHubTransport,
	isGitHubVirtualUrl: () => isGitHubVirtualUrl,
	parseGitHubSpecifier: () => parseGitHubSpecifier,
	parseGitHubVirtualUrl: () => parseGitHubVirtualUrl,
	resolveGitHubVirtualImport: () => resolveGitHubVirtualImport,
	resolvePrivateGitHubTarget: () => resolvePrivateGitHubTarget
});
const DEFAULT_OCTOKIT_URL = "https://esm.sh/@octokit/core@7.0.6";
const PRIVATE_GITHUB_PROTOCOL = "gh-private:";
const octokitCache = /* @__PURE__ */ new WeakMap();
/** Parse github:owner/repo[/package/path]#ref and gh: aliases. */
function parseGitHubSpecifier(value) {
	const raw = String(value || "").trim();
	const prefix = raw.startsWith("github:") ? "github:" : raw.startsWith("gh:") ? "gh:" : "";
	if (!prefix) return null;
	const body = raw.slice(prefix.length);
	const hashIndex = body.indexOf("#");
	const repoAndPath = hashIndex >= 0 ? body.slice(0, hashIndex) : body;
	const ref = hashIndex >= 0 ? body.slice(hashIndex + 1).trim() : "";
	const parts = repoAndPath.split("/").filter(Boolean);
	if (parts.length < 2) throw new TypeError(`Invalid GitHub repository specifier: ${value}`);
	return {
		owner: parts[0],
		repo: parts[1],
		ref,
		path: parts.slice(2).join("/")
	};
}
/** Whether options request authenticated/direct GitHub resolution. */
function hasPrivateGitHubTransport(options = {}) {
	const github = options.github;
	return !!github && !!(github.token || github.fetch || github.octokit || github.octokitUrl);
}
/** Resolve an authenticated github:/gh: input to private virtual runtime/type URLs. */
async function resolvePrivateGitHubTarget(input, options = {}) {
	if (!hasPrivateGitHubTransport(options)) return null;
	const specifier = typeof input === "string" ? input : input?.specifier || options.specifier || "";
	const parsed = parseGitHubSpecifier(specifier);
	if (!parsed) return null;
	const ref = parsed.ref || await getDefaultBranch(parsed.owner, parsed.repo, options);
	const explicitFile = isRuntimeFilePath(parsed.path) ? parsed.path : "";
	const packageRoot = explicitFile ? dirname(explicitFile) : parsed.path.replace(/^\/+|\/+$/g, "");
	let runtimePath = explicitFile;
	let dtsPath = options.dtsUrl || (typeof input === "object" && input ? input.dtsUrl || "" : "");
	if (!runtimePath) {
		const packagePath = joinPath(packageRoot, "package.json");
		const pkg = JSON.parse(await fetchGitHubFile(parsed.owner, parsed.repo, ref, packagePath, options));
		runtimePath = joinPath(packageRoot, pickPackageRuntimeEntry(pkg));
		if (!dtsPath) {
			const declarationEntry = pickPackageDeclarationEntry(pkg);
			if (declarationEntry) dtsPath = joinPath(packageRoot, declarationEntry);
		}
	}
	if (!runtimePath) throw new Error(`Could not determine a runtime entry for ${specifier}.`);
	if (!dtsPath) dtsPath = await inferGitHubDeclarationPath(parsed.owner, parsed.repo, ref, runtimePath, options);
	else if (!isAbsoluteUrl$1(dtsPath)) dtsPath = joinPath(packageRoot, dtsPath);
	return {
		input,
		specifier,
		runtimeUrl: createGitHubVirtualUrl(parsed.owner, parsed.repo, ref, runtimePath),
		metaUrl: "",
		dtsUrl: dtsPath ? isAbsoluteUrl$1(dtsPath) ? dtsPath : createGitHubVirtualUrl(parsed.owner, parsed.repo, ref, dtsPath) : "",
		isUrl: true,
		esmBase: options.esmBase || "https://esm.sh"
	};
}
/** Create an opaque URL that identifies a private GitHub file without embedding credentials. */
function createGitHubVirtualUrl(owner, repo, ref, path) {
	const encodedPath = String(path || "").replace(/^\/+/, "").split("/").filter(Boolean).map(encodeURIComponent).join("/");
	return `${PRIVATE_GITHUB_PROTOCOL}//${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${encodedPath}`;
}
function isGitHubVirtualUrl(value) {
	return String(value || "").startsWith(`${PRIVATE_GITHUB_PROTOCOL}//`);
}
function parseGitHubVirtualUrl(value) {
	const url = new URL(value);
	if (url.protocol !== "gh-private:") throw new TypeError(`Not a private GitHub virtual URL: ${value}`);
	const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
	if (parts.length < 2) throw new TypeError(`Malformed private GitHub virtual URL: ${value}`);
	return {
		owner: decodeURIComponent(url.hostname),
		repo: parts[0],
		ref: parts[1],
		path: parts.slice(2).join("/")
	};
}
/** Resolve a repository-local import while retaining owner/repo/ref identity. */
function resolveGitHubVirtualImport(fromUrl, specifier) {
	if (!isGitHubVirtualUrl(fromUrl)) return new URL(specifier, fromUrl).href;
	if (specifier.startsWith("/") && !specifier.startsWith("//")) {
		const file = parseGitHubVirtualUrl(fromUrl);
		return createGitHubVirtualUrl(file.owner, file.repo, file.ref, specifier.slice(1));
	}
	return new URL(specifier, fromUrl).href;
}
/** Read a gh-private: file via GitHub Contents API using fetch or Octokit. */
async function fetchGitHubVirtualText(url, options = {}) {
	const file = parseGitHubVirtualUrl(url);
	return fetchGitHubFile(file.owner, file.repo, file.ref, file.path, options);
}
async function fetchGitHubFile(owner, repo, ref, path, options = {}) {
	const github = options.github || {};
	const octokit = await getOctokit(github);
	if (octokit) return decodeGitHubContent((await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
		owner,
		repo,
		path,
		...ref ? { ref } : {},
		headers: { accept: "application/vnd.github.raw+json" }
	}))?.data);
	const apiBase = (github.apiBaseUrl || "https://api.github.com").replace(/\/$/, "");
	const url = new URL(`${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`);
	if (ref) url.searchParams.set("ref", ref);
	const response = await githubFetch(url.href, {
		method: "GET",
		headers: githubHeaders(github, "application/vnd.github.raw+json")
	}, github);
	if (!response?.ok) throw githubHttpError("file", owner, repo, path, response);
	return await response.text();
}
async function getDefaultBranch(owner, repo, options) {
	const github = options.github || {};
	const octokit = await getOctokit(github);
	if (octokit) {
		const branch = (await octokit.request("GET /repos/{owner}/{repo}", {
			owner,
			repo
		}))?.data?.default_branch;
		if (!branch) throw new Error(`GitHub did not return a default branch for ${owner}/${repo}.`);
		return String(branch);
	}
	const response = await githubFetch(`${(github.apiBaseUrl || "https://api.github.com").replace(/\/$/, "")}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
		method: "GET",
		headers: githubHeaders(github, "application/vnd.github+json")
	}, github);
	if (!response?.ok) throw githubHttpError("repository", owner, repo, "", response);
	const data = await response.json();
	if (!data?.default_branch) throw new Error(`GitHub did not return a default branch for ${owner}/${repo}.`);
	return String(data.default_branch);
}
async function inferGitHubDeclarationPath(owner, repo, ref, runtimePath, options) {
	if (/\.(?:ts|tsx|mts|cts)$/i.test(runtimePath) && !/\.d\.(?:ts|mts|cts)$/i.test(runtimePath)) return runtimePath;
	const candidates = declarationCandidates(runtimePath);
	for (const candidate of candidates) try {
		await fetchGitHubFile(owner, repo, ref, candidate, options);
		return candidate;
	} catch {}
	return "";
}
function pickPackageRuntimeEntry(pkg) {
	return stripDotSlash(pickConditionalExport(packageExportRoot(pkg?.exports), [
		"browser",
		"import",
		"module",
		"default",
		"require"
	], true) || (typeof pkg?.module === "string" ? pkg.module : "") || (typeof pkg?.browser === "string" ? pkg.browser : "") || (typeof pkg?.main === "string" ? pkg.main : "") || "index.js");
}
function pickPackageDeclarationEntry(pkg) {
	return stripDotSlash(pickConditionalExport(packageExportRoot(pkg?.exports), ["types", "typings"], false) || (typeof pkg?.types === "string" ? pkg.types : "") || (typeof pkg?.typings === "string" ? pkg.typings : ""));
}
function packageExportRoot(exportsField) {
	if (!exportsField || typeof exportsField !== "object" || Array.isArray(exportsField)) return exportsField;
	return Object.keys(exportsField).some((key) => key.startsWith(".")) ? exportsField["."] : exportsField;
}
function pickConditionalExport(value, conditions, fallback) {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) {
		for (const item of value) {
			const picked = pickConditionalExport(item, conditions, fallback);
			if (picked) return picked;
		}
		return "";
	}
	if (!value || typeof value !== "object") return "";
	for (const condition of conditions) {
		const picked = pickConditionalExport(value[condition], conditions, fallback);
		if (picked) return picked;
	}
	if (fallback) for (const child of Object.values(value)) {
		const picked = pickConditionalExport(child, conditions, fallback);
		if (picked) return picked;
	}
	return "";
}
async function getOctokit(github) {
	if (github.octokit && github.octokit !== true) {
		const candidate = github.octokit;
		if (typeof candidate.request === "function") return candidate;
		if (typeof candidate === "function") return new candidate(octokitConstructorOptions(github));
	}
	if (github.octokit !== true && !github.octokitUrl) return null;
	const key = github;
	let pending = octokitCache.get(key);
	if (!pending) {
		pending = (async () => {
			const moduleUrl = github.octokitUrl || "https://esm.sh/@octokit/core@7.0.6";
			const mod = await import(
				/* @vite-ignore */
				moduleUrl
);
			const Octokit = mod?.Octokit || mod?.default?.Octokit || mod?.default;
			if (typeof Octokit !== "function") throw new TypeError(`No Octokit constructor found in ${moduleUrl}.`);
			return new Octokit(octokitConstructorOptions(github));
		})();
		octokitCache.set(key, pending);
	}
	return pending;
}
function octokitConstructorOptions(github) {
	return {
		...github.token ? { auth: github.token } : {},
		...github.fetch ? { request: { fetch: github.fetch } } : {},
		...github.apiBaseUrl ? { baseUrl: github.apiBaseUrl } : {}
	};
}
async function githubFetch(url, init, github) {
	const remoteFetch = globalThis.remoteFetchAsync;
	const fetchImpl = github.fetch || (typeof remoteFetch === "function" ? remoteFetch : globalThis.fetch);
	if (typeof fetchImpl !== "function") throw new Error("No fetch implementation available for GitHub. Pass options.github.fetch or provide fetch/remoteFetchAsync globally.");
	return await fetchImpl(url, init);
}
function githubHeaders(github, accept) {
	return {
		accept,
		"x-github-api-version": "2022-11-28",
		...github.token ? { authorization: `Bearer ${github.token}` } : {}
	};
}
function decodeGitHubContent(data) {
	if (typeof data === "string") return data;
	if (data && typeof data.content === "string") {
		const compact = data.content.replace(/\s+/g, "");
		if (typeof globalThis.atob === "function") return decodeURIComponent(Array.from(globalThis.atob(compact), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
		const BufferCtor = globalThis.Buffer;
		if (BufferCtor) return BufferCtor.from(compact, "base64").toString("utf8");
	}
	throw new TypeError("GitHub Contents API did not return decodable file content.");
}
function githubHttpError(kind, owner, repo, path, response) {
	const suffix = path ? `/${path}` : "";
	const error = /* @__PURE__ */ new Error(`Failed to fetch private GitHub ${kind} ${owner}/${repo}${suffix}: ${response?.status ?? "unknown"}`);
	error.status = response?.status;
	error.code = "ERR_PRIVATE_GITHUB_FETCH";
	return error;
}
function declarationCandidates(runtimePath) {
	const out = /* @__PURE__ */ new Set();
	const add = (value) => value && out.add(value);
	if (/\.mjs$/i.test(runtimePath)) {
		add(runtimePath.replace(/\.mjs$/i, ".d.mts"));
		add(runtimePath.replace(/\.mjs$/i, ".d.ts"));
	} else if (/\.cjs$/i.test(runtimePath)) {
		add(runtimePath.replace(/\.cjs$/i, ".d.cts"));
		add(runtimePath.replace(/\.cjs$/i, ".d.ts"));
	} else if (/\.(?:js|jsx)$/i.test(runtimePath)) add(runtimePath.replace(/\.(?:js|jsx)$/i, ".d.ts"));
	add(joinPath(dirname(runtimePath), "index.d.ts"));
	return Array.from(out);
}
function isRuntimeFilePath(path) {
	return /\.(?:[cm]?[jt]sx?|mjs|cjs)$/i.test(path);
}
function isAbsoluteUrl$1(value) {
	try {
		new URL(value);
		return true;
	} catch {
		return false;
	}
}
function stripDotSlash(value) {
	return String(value || "").replace(/^\.\//, "");
}
function dirname(path) {
	const clean = String(path || "").replace(/^\/+|\/+$/g, "");
	const slash = clean.lastIndexOf("/");
	return slash >= 0 ? clean.slice(0, slash) : "";
}
function joinPath(...parts) {
	return parts.filter(Boolean).map((part) => String(part).replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
}
//#endregion
//#region package.json
var devDependencies = {
	"@opengsd/gsd-core": "^1.6.1",
	"@types/node": "^26.1.0",
	"tsdown": "^0.22.3",
	"typescript": "6.0.3"
};
//#endregion
//#region src/url.ts
var url_exports = /* @__PURE__ */ __exportAll({
	appendQuery: () => appendQuery,
	esmMetaUrl: () => esmMetaUrl,
	esmUrl: () => esmUrl,
	inferSpecifierFromUrl: () => inferSpecifierFromUrl,
	isAbsoluteUrl: () => isAbsoluteUrl,
	isHttpUrl: () => isHttpUrl,
	normalizePackageSpecifier: () => normalizePackageSpecifier,
	normalizeRemoteEsmTarget: () => normalizeRemoteEsmTarget,
	toAbsoluteCdnUrl: () => toAbsoluteCdnUrl
});
/** Test whether a string is an absolute URL with any scheme. */
function isAbsoluteUrl(value) {
	try {
		new URL(String(value || ""));
		return true;
	} catch {
		return false;
	}
}
/** Test whether a string is an absolute HTTP(S) URL. */
function isHttpUrl(value) {
	return /^https?:\/\//i.test(String(value || ""));
}
/** Append query params to a URL. Empty-string values become valueless query flags. */
function appendQuery(url, params = {}) {
	const u = new URL(url);
	for (const [key, value] of Object.entries(params)) if (value !== void 0 && value !== null && value !== false) u.searchParams.set(key, value === true ? "" : String(value));
	return u.href.replace(/=$/, "");
}
/** Build an esm.sh runtime URL from an npm/GitHub specifier. */
function esmUrl(specifier, options = {}) {
	let url = `${(options.esmBase || "https://esm.sh").replace(/\/$/, "")}/${normalizePackageSpecifier(String(specifier).replace(/^\//, ""))}`;
	if (options.bundle) url = appendQuery(url, { bundle: "" });
	if (options.target) url = appendQuery(url, { target: options.target });
	if (options.dev) url = appendQuery(url, { dev: "" });
	return url;
}
/** Build an esm.sh metadata URL. */
function esmMetaUrl(specifier, options = {}) {
	return appendQuery(esmUrl(specifier, options), { meta: "" });
}
/** Convert a metadata/declaration path to an absolute URL. */
function toAbsoluteCdnUrl(pathOrUrl, baseUrlOrOptions = {}) {
	if (!pathOrUrl) return "";
	if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl;
	if (typeof baseUrlOrOptions === "string" && isAbsoluteUrl(baseUrlOrOptions)) return new URL(pathOrUrl, baseUrlOrOptions).href;
	return `${(baseUrlOrOptions.esmBase || "https://esm.sh").replace(/\/$/, "")}/${String(pathOrUrl).replace(/^\//, "")}`;
}
/** Normalize a user-supplied package/URL/object into runtime/meta/dts URLs. */
function normalizeRemoteEsmTarget(input, options = {}) {
	const esmBase = options.esmBase || "https://esm.sh";
	if (typeof input === "object" && input !== null) {
		const runtimeUrl = input.runtimeUrl || input.url || options.runtimeUrl || options.url || "";
		const specifier = input.specifier || options.specifier || (runtimeUrl ? inferSpecifierFromUrl(runtimeUrl) : "") || runtimeUrl;
		const finalRuntimeUrl = runtimeUrl || esmUrl(specifier, options);
		return {
			input,
			specifier,
			runtimeUrl: finalRuntimeUrl,
			metaUrl: input.metaUrl || options.metaUrl || (finalRuntimeUrl ? appendQuery(finalRuntimeUrl, { meta: "" }) : ""),
			dtsUrl: input.dtsUrl || options.dtsUrl || "",
			isUrl: !!runtimeUrl && isHttpUrl(runtimeUrl),
			esmBase
		};
	}
	const raw = String(input || "").trim();
	const optionRuntimeUrl = options.runtimeUrl || options.url || "";
	if (optionRuntimeUrl || isHttpUrl(raw)) {
		const runtimeUrl = optionRuntimeUrl || raw;
		return {
			input,
			specifier: options.specifier || inferSpecifierFromUrl(runtimeUrl) || raw,
			runtimeUrl,
			metaUrl: options.metaUrl || appendQuery(runtimeUrl, { meta: "" }),
			dtsUrl: options.dtsUrl || "",
			isUrl: true,
			esmBase
		};
	}
	const specifier = normalizePackageSpecifier(raw || options.specifier || "");
	return {
		input,
		specifier,
		runtimeUrl: esmUrl(specifier, options),
		metaUrl: options.metaUrl || esmMetaUrl(specifier, options),
		dtsUrl: options.dtsUrl || "",
		isUrl: false,
		esmBase
	};
}
/** Normalize supported aliases such as npm: and github:user/repo#commit. */
function normalizePackageSpecifier(specifier) {
	let value = String(specifier || "").trim();
	if (value.startsWith("npm:")) return value.slice(4);
	if (value.startsWith("github:")) {
		value = value.slice(7);
		const [repoPath, commit] = value.split("#");
		return commit ? `gh/${repoPath}@${commit}` : `gh/${repoPath}`;
	}
	if (value.startsWith("gh:")) {
		value = value.slice(3);
		const [repoPath, commit] = value.split("#");
		return commit ? `gh/${repoPath}@${commit}` : `gh/${repoPath}`;
	}
	return value;
}
/** Infer a package-ish specifier from a CDN URL when possible. */
function inferSpecifierFromUrl(url) {
	try {
		const u = new URL(url);
		const path = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
		if (u.hostname.includes("esm.sh")) return path.replace(/^(stable|v\d+)\//, "");
		if (u.hostname.includes("unpkg.com") || u.hostname.includes("jsdelivr.net")) return path.replace(/^npm\//, "");
		return path || url;
	} catch {
		return url;
	}
}
//#endregion
//#region src/network.ts
var network_exports = /* @__PURE__ */ __exportAll({
	DEFAULT_TYPESCRIPT_URL: () => DEFAULT_TYPESCRIPT_URL,
	TYPESCRIPT_VERSION: () => TYPESCRIPT_VERSION,
	getJson: () => getJson,
	getText: () => getText,
	importModuleCached: () => importModuleCached,
	loadTypeScript: () => loadTypeScript,
	resolveTypeScriptUrl: () => resolveTypeScriptUrl
});
const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
/** Exact TypeScript version used for remote compiler imports. */
const TYPESCRIPT_VERSION = getPinnedTypeScriptVersion(devDependencies?.typescript);
/** Default esm.sh URL for the TypeScript compiler API. */
const DEFAULT_TYPESCRIPT_URL = `https://esm.sh/typescript@${TYPESCRIPT_VERSION}`;
/** Fetch text through authenticated GitHub transport, Airtable remoteFetchAsync, or fetch. */
async function getText(url, options = {}) {
	return vmMemo(remoteEsmVm.text, url, async () => {
		if (isGitHubVirtualUrl(url)) return await fetchGitHubVirtualText(url, options);
		const remoteFetch = globalThis.remoteFetchAsync;
		let response;
		if (typeof remoteFetch === "function") response = await remoteFetch(url);
		else if (typeof fetch === "function") response = await fetch(url);
		else throw new Error("No fetch API found. Expected remoteFetchAsync or fetch.");
		if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
		return await response.text();
	});
}
/** Fetch and parse JSON. */
async function getJson(url, options = {}) {
	return vmMemo(remoteEsmVm.json, url, async () => {
		return JSON.parse(await getText(url, options));
	});
}
/** Import a module URL with memory caching, including authenticated GitHub virtual modules. */
async function importModuleCached(url, options = {}) {
	return vmMemo(remoteEsmVm.module, url, async () => {
		if (isGitHubVirtualUrl(url)) return await importGitHubVirtualModule(url, options);
		return await import(url);
	});
}
/** Ensure a bare esm.sh TypeScript URL is pinned to the package.json compiler version. */
function resolveTypeScriptUrl(tsUrl = DEFAULT_TYPESCRIPT_URL) {
	const url = new URL(tsUrl);
	const hostname = url.hostname.toLowerCase();
	if ((hostname === "esm.sh" || hostname.endsWith(".esm.sh")) && url.pathname === "/typescript") {
		url.pathname = `/typescript@${TYPESCRIPT_VERSION}`;
		return url.href;
	}
	return tsUrl;
}
/** Load the TypeScript compiler API from esm.sh. */
async function loadTypeScript(tsUrl = DEFAULT_TYPESCRIPT_URL) {
	if (remoteEsmVm.ts) return remoteEsmVm.ts;
	const tsModule = await import(resolveTypeScriptUrl(tsUrl));
	remoteEsmVm.ts = tsModule.default || tsModule;
	return remoteEsmVm.ts;
}
async function importGitHubVirtualModule(url, options) {
	return await import(await buildGitHubExecutableUrl(url, options, /* @__PURE__ */ new Map(), []));
}
async function buildGitHubExecutableUrl(url, options, generated, stack) {
	if (stack.includes(url)) {
		const cycle = [...stack.slice(stack.indexOf(url)), url].map((item) => parseGitHubVirtualUrl(item).path).join(" -> ");
		const error = /* @__PURE__ */ new Error(`Cyclic private GitHub runtime imports are not supported by the header-auth loader: ${cycle}. Point the package entry at a pre-bundled ESM build to avoid the cycle.`);
		error.code = "ERR_PRIVATE_GITHUB_MODULE_CYCLE";
		throw error;
	}
	const cached = generated.get(url);
	if (cached) return await cached;
	const pending = (async () => {
		const file = parseGitHubVirtualUrl(url);
		let source = await getText(url, options);
		if (/\.json$/i.test(file.path)) source = `export default ${source.trim()};`;
		else if (/\.(?:ts|tsx|mts|cts)$/i.test(file.path) && !/\.d\.(?:ts|mts|cts)$/i.test(file.path)) {
			const ts = await loadTypeScript(options.tsUrl || DEFAULT_TYPESCRIPT_URL);
			source = ts.transpileModule(source, {
				fileName: file.path,
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ES2022,
					jsx: ts.JsxEmit?.ReactJSX ?? ts.JsxEmit?.Preserve,
					sourceMap: false,
					inlineSourceMap: false
				}
			}).outputText;
		}
		const nextStack = [...stack, url];
		source = await rewriteModuleSpecifiersAsync(source, async (specifier) => {
			if (!specifier || specifier.startsWith("node:") || specifier.startsWith("data:") || specifier.startsWith("blob:")) return specifier;
			if (specifier.startsWith(".") || specifier.startsWith("/") && !specifier.startsWith("//")) return await buildGitHubExecutableUrl(resolveGitHubVirtualImport(url, specifier), options, generated, nextStack);
			if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(specifier)) return specifier;
			return esmUrl(specifier, options);
		});
		source += `\n//# sourceURL=${url}\n`;
		return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
	})();
	generated.set(url, pending);
	try {
		return await pending;
	} catch (error) {
		generated.delete(url);
		throw error;
	}
}
async function rewriteModuleSpecifiersAsync(source, rewrite) {
	let result = String(source);
	result = await replaceAsync(result, /(\b(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\s+from\s*)?)(["'])([^"']+)\2/g, async (_full, prefix, quote, specifier) => `${prefix}${quote}${await rewrite(specifier)}${quote}`);
	result = await replaceAsync(result, /(\bimport\s*\(\s*)(["'])([^"']+)\2(\s*\))/g, async (_full, prefix, quote, specifier, suffix) => `${prefix}${quote}${await rewrite(specifier)}${quote}${suffix}`);
	return result;
}
async function replaceAsync(source, pattern, replacer) {
	const matches = Array.from(source.matchAll(pattern));
	if (!matches.length) return source;
	let cursor = 0;
	const out = [];
	for (const match of matches) {
		const index = match.index ?? 0;
		out.push(source.slice(cursor, index));
		out.push(await replacer(...match.map((value) => value ?? "")));
		cursor = index + match[0].length;
	}
	out.push(source.slice(cursor));
	return out.join("");
}
function getPinnedTypeScriptVersion(value) {
	if (typeof value !== "string" || !exactVersionPattern.test(value)) throw new Error(`package.json devDependencies.typescript must be an exact version, received ${JSON.stringify(value)}.`);
	return value;
}
//#endregion
//#region src/dtsGraph.ts
var dtsGraph_exports = /* @__PURE__ */ __exportAll({
	expandDtsCandidates: () => expandDtsCandidates,
	extractDtsImportSpecifiers: () => extractDtsImportSpecifiers,
	firstWorkingDtsCandidate: () => firstWorkingDtsCandidate,
	loadDtsGraph: () => loadDtsGraph,
	resolveDeclarationUrl: () => resolveDeclarationUrl,
	resolveDtsImport: () => resolveDtsImport
});
/** Resolve a target's declaration URL from explicit options or esm.sh ?meta. */
async function resolveDeclarationUrl(target, options = {}) {
	const cacheKey = JSON.stringify({
		explicit: target.dtsUrl || options.dtsUrl || "",
		metaUrl: target.metaUrl || options.metaUrl || "",
		runtimeUrl: target.runtimeUrl
	});
	return vmMemo(remoteEsmVm.dtsUrl, cacheKey, async () => {
		if (target.dtsUrl || options.dtsUrl) return toAbsoluteCdnUrl(target.dtsUrl || options.dtsUrl || "", target.runtimeUrl);
		if (!target.metaUrl) throw new Error(`No d.ts URL or metadata URL available for ${target.specifier}.`);
		const meta = await getJson(target.metaUrl, options);
		const dtsPath = meta?.default?.dts || meta?.dts || meta?.types || meta?.typings;
		if (!dtsPath) throw new Error(`No d.ts path found in metadata for ${target.specifier}.`);
		return toAbsoluteCdnUrl(dtsPath, target.runtimeUrl);
	});
}
/** Fetch an entry declaration file plus reachable declaration imports. */
async function loadDtsGraph(entryUrl, options = {}) {
	const { maxDepth = 5, maxFiles = 80, includeBareDtsImports = true } = options;
	const graphCacheKey = JSON.stringify({
		entryUrl,
		maxDepth,
		maxFiles,
		includeBareDtsImports,
		esmBase: options.esmBase || "https://esm.sh"
	});
	return vmMemo(remoteEsmVm.dtsGraph, graphCacheKey, async () => {
		const visited = /* @__PURE__ */ new Set();
		const files = [];
		const failed = [];
		async function visit(url, depth) {
			if (!url || visited.has(url)) return;
			if (files.length >= maxFiles) return;
			if (depth > maxDepth) return;
			visited.add(url);
			let text = "";
			try {
				text = await getText(url, options);
			} catch (error) {
				failed.push({
					url,
					error: String(error?.message || error)
				});
				return;
			}
			files.push({
				url,
				text
			});
			const imports = extractDtsImportSpecifiers(text);
			for (const imported of imports) {
				if (files.length >= maxFiles) break;
				const resolved = await resolveDtsImport(url, imported, {
					...options,
					includeBareDtsImports
				});
				if (resolved) await visit(resolved, depth + 1);
			}
		}
		await visit(entryUrl, 0);
		return {
			entryUrl,
			files,
			failed
		};
	});
}
/** Extract imported/referenced declaration specifiers from .d.ts text. */
function extractDtsImportSpecifiers(text) {
	const out = /* @__PURE__ */ new Set();
	const source = String(text || "");
	for (const pattern of [
		/\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
		/\bexport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
		/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
		/\/\/\/\s*<reference\s+types=["']([^"']+)["']/g,
		/\/\/\/\s*<reference\s+path=["']([^"']+)["']/g
	]) {
		let match;
		while (match = pattern.exec(source)) if (match[1]) out.add(match[1]);
	}
	return Array.from(out);
}
/** Resolve an import found in a declaration file to a fetchable declaration URL. */
async function resolveDtsImport(fromUrl, imported, options = {}) {
	const spec = String(imported || "").trim();
	if (!spec) return "";
	if (spec.startsWith("node:")) return "";
	if (isHttpUrl(spec)) return await firstWorkingDtsCandidate([spec], options);
	if (spec.startsWith("/") && !spec.startsWith("//")) return await firstWorkingDtsCandidate(expandDtsCandidates(isGitHubVirtualUrl(fromUrl) ? resolveGitHubVirtualImport(fromUrl, spec) : `${new URL(fromUrl).origin}${spec}`), options);
	if (spec.startsWith(".")) return await firstWorkingDtsCandidate(expandDtsCandidates(isGitHubVirtualUrl(fromUrl) ? resolveGitHubVirtualImport(fromUrl, spec) : new URL(spec, fromUrl).href), options);
	if (!options.includeBareDtsImports) return "";
	try {
		const metaUrl = appendQuery(`${(options.esmBase || "https://esm.sh").replace(/\/$/, "")}/${spec.replace(/^\//, "")}`, { meta: "" });
		const meta = await getJson(metaUrl, options);
		const dtsPath = meta?.default?.dts || meta?.dts || meta?.types || meta?.typings;
		return dtsPath ? toAbsoluteCdnUrl(dtsPath, metaUrl) : "";
	} catch {
		return "";
	}
}
/** Expand a possible declaration path into candidate paths. */
function expandDtsCandidates(url) {
	if (/\.(d\.ts|d\.cts|d\.mts|ts|cts|mts)$/i.test(url)) return [url];
	return [
		url,
		`${url}.d.ts`,
		`${url}.d.cts`,
		`${url}.d.mts`,
		`${url}.ts`,
		`${url}/index.d.ts`,
		`${url}/index.d.cts`,
		`${url}/index.d.mts`
	];
}
/** Return the first declaration URL that can be fetched. */
async function firstWorkingDtsCandidate(candidates, options = {}) {
	for (const candidate of candidates) try {
		await getText(candidate, options);
		return candidate;
	} catch {}
	return "";
}
//#endregion
//#region src/jsdoc.ts
var jsdoc_exports = /* @__PURE__ */ __exportAll({
	aliasBasicType: () => aliasBasicType,
	appendRawDocLines: () => appendRawDocLines,
	attachCompletionTypeJsdoc: () => attachCompletionTypeJsdoc,
	buildGlobalDefinitions: () => buildGlobalDefinitions,
	buildImportTypeDefinitions: () => buildImportTypeDefinitions,
	buildShorthandDefinition: () => buildShorthandDefinition,
	callableEntryToSafeArrowType: () => callableEntryToSafeArrowType,
	cleanDoc: () => cleanDoc,
	cleanTagName: () => cleanTagName,
	completionTypeToSafeJsdoc: () => completionTypeToSafeJsdoc,
	completionsToSafeJsdoc: () => completionsToSafeJsdoc,
	escapeRegExp: () => escapeRegExp,
	extractPropertyType: () => extractPropertyType,
	extractTemplateNames: () => extractTemplateNames,
	extractTypeAliasType: () => extractTypeAliasType,
	findMatchingParen: () => findMatchingParen,
	findTopLevelArrow: () => findTopLevelArrow,
	findTopLevelChar: () => findTopLevelChar,
	getRequiredTemplateCount: () => getRequiredTemplateCount,
	isPrimitiveOrBuiltin: () => isPrimitiveOrBuiltin,
	joinDefinitionLines: () => joinDefinitionLines,
	mergeJsdocOptions: () => mergeJsdocOptions,
	normalizeJsdocSettings: () => normalizeJsdocSettings,
	oneLine: () => oneLine,
	parseArrowFunctionType: () => parseArrowFunctionType,
	parseCallableDetail: () => parseCallableDetail,
	parseGenericType: () => parseGenericType,
	parseParams: () => parseParams,
	renderArrowParam: () => renderArrowParam,
	renderJsdocBlock: () => renderJsdocBlock,
	renderJsdocDefinitions: () => renderJsdocDefinitions,
	renderOneLineJsdocBlock: () => renderOneLineJsdocBlock,
	renderSafeProperty: () => renderSafeProperty,
	sanitizeParamName: () => sanitizeParamName,
	shouldOmitObjectTypedefType: () => shouldOmitObjectTypedefType,
	spaceToDocLines: () => spaceToDocLines,
	spaceToRawSeparator: () => spaceToRawSeparator,
	splitTopLevel: () => splitTopLevel,
	toSafeArrowType: () => toSafeArrowType,
	toSafeGenericArgument: () => toSafeGenericArgument,
	toSafeJsdocType: () => toSafeJsdocType
});
/** Convert completion JSON into safe JSDoc typedef blocks. */
function completionsToSafeJsdoc(completions, options = {}) {
	const context = createJsdocBuildContext(completions, options);
	const typedefDefs = buildTypedefDefinitionsForTypes(context, getSortedTypeNames(context));
	const importTypeDefs = buildImportTypeDefinitions(context.flat, context.originalTypeNames, context.settings);
	const globalDefs = context.settings.includeGlobals ? buildGlobalDefinitions(context.flat, context.originalTypeNames, {
		settings: context.settings,
		outTypeName: context.outTypeName
	}) : [];
	return renderJsdocDefinitions([...importTypeDefs, ...typedefDefs], globalDefs, context.settings);
}
/** Convert one completion type record into safe JSDoc. */
function completionTypeToSafeJsdoc(completions, typeName, options = {}) {
	const context = createJsdocBuildContext(completions, {
		...options,
		includeGlobals: false
	});
	if (!context.originalTypeNames.has(typeName)) return "";
	return renderJsdocDefinitions(buildTypedefDefinitionsForTypes(context, collectReferencedTypeNames(context, typeName)), [], context.settings);
}
/** Attach non-enumerable per-type JSDoc helpers to completion type records. */
function attachCompletionTypeJsdoc(completions, options = {}) {
	const types = completions?.types && typeof completions.types === "object" ? completions.types : {};
	for (const typeName of Object.keys(types)) {
		const typeInfo = types[typeName];
		if (!typeInfo || typeof typeInfo !== "object") continue;
		Object.defineProperty(typeInfo, "toJsdoc", {
			configurable: true,
			enumerable: false,
			writable: true,
			value(jsdoc) {
				const mergedOptions = { ...options };
				const mergedJsdoc = mergeJsdocOptions(options.jsdoc, jsdoc);
				if (mergedJsdoc) mergedOptions.jsdoc = mergedJsdoc;
				return completionTypeToSafeJsdoc(completions, typeName, mergedOptions);
			}
		});
	}
	return completions;
}
function mergeJsdocOptions(base, override) {
	if (!base && !override) return void 0;
	const merged = {
		...base || {},
		...override || {}
	};
	if (base?.tags || override?.tags) merged.tags = {
		...base?.tags || {},
		...override?.tags || {}
	};
	if (base?.importTypes || override?.importTypes) merged.importTypes = {
		...base?.importTypes || {},
		...override?.importTypes || {}
	};
	if (typeof base?.shorthand === "object" || typeof override?.shorthand === "object") {
		const shorthand = {
			...typeof base?.shorthand === "object" ? base.shorthand : {},
			...typeof override?.shorthand === "object" ? override.shorthand : {}
		};
		const baseTypes = typeof base?.shorthand === "object" ? base.shorthand.types : void 0;
		const overrideTypes = typeof override?.shorthand === "object" ? override.shorthand.types : void 0;
		if (baseTypes || overrideTypes) shorthand.types = {
			...baseTypes || {},
			...overrideTypes || {}
		};
		merged.shorthand = shorthand;
	}
	return merged;
}
function createJsdocBuildContext(completions, options = {}) {
	const settings = normalizeJsdocSettings(options);
	const flat = Array.isArray(completions?.flat) ? completions.flat : [];
	const types = completions?.types && typeof completions.types === "object" ? completions.types : {};
	const originalTypeNames = /* @__PURE__ */ new Set([...Object.keys(types), ...flat.filter((entry) => [
		"Interface",
		"Class",
		"TypeAlias",
		"Enum"
	].includes(entry.kind)).map((entry) => entry.label)]);
	settings.__typeEntries = /* @__PURE__ */ new Map();
	for (const typeName of originalTypeNames) settings.__typeEntries.set(typeName, {
		typeEntry: flat.find((entry) => entry.label === typeName),
		typeInfo: types[typeName] || {
			kind: "",
			detail: "",
			members: []
		}
	});
	function outTypeName(name) {
		return originalTypeNames.has(name) ? `${name}${settings.typeNameSuffix}` : name;
	}
	const byMemberOf = Object.create(null);
	for (const entry of flat) {
		if (!entry?.memberOf) continue;
		(byMemberOf[entry.memberOf] ??= []).push(entry);
	}
	return {
		flat,
		types,
		settings,
		originalTypeNames,
		byMemberOf,
		outTypeName
	};
}
function getSortedTypeNames(context) {
	let typeNames = Array.from(context.originalTypeNames);
	if (context.settings.sort) typeNames = typeNames.sort((a, b) => a.localeCompare(b));
	return typeNames;
}
function buildTypedefDefinitionsForTypes(context, typeNames) {
	const typedefDefs = [];
	for (const typeName of typeNames) {
		const typeInfo = context.types[typeName] || {
			kind: "",
			detail: "",
			members: []
		};
		const settings = context.settings;
		const typeEntry = context.flat.find((entry) => entry.label === typeName);
		const kind = typeEntry?.kind || typeInfo.kind || "Interface";
		const emittedName = context.outTypeName(typeName);
		const templateNames = extractTemplateNames(typeName, typeEntry, typeInfo);
		const ctx = {
			settings,
			unknownType: settings.unknownType,
			originalTypeNames: context.originalTypeNames,
			outTypeName: context.outTypeName,
			templateNames: new Set(templateNames),
			functionUnknownType: "any"
		};
		typedefDefs.push(buildTypedefDefinition({
			typeName,
			emittedName,
			kind,
			typeEntry,
			typeInfo,
			members: context.byMemberOf[typeName] || [],
			templateNames,
			ctx,
			settings
		}));
	}
	return typedefDefs;
}
function collectReferencedTypeNames(context, rootTypeName) {
	const ordered = [];
	const visiting = /* @__PURE__ */ new Set();
	const visited = /* @__PURE__ */ new Set();
	function visit(typeName) {
		if (!context.originalTypeNames.has(typeName)) return;
		if (visited.has(typeName) || visiting.has(typeName)) return;
		visiting.add(typeName);
		const references = extractRenderedTypeReferences(buildTypedefDefinitionsForTypes(context, [typeName]).flatMap((def) => def.lines).join("\n"), context);
		for (const reference of references) visit(reference);
		visiting.delete(typeName);
		visited.add(typeName);
		ordered.push(typeName);
	}
	visit(rootTypeName);
	return ordered;
}
function extractRenderedTypeReferences(source, context) {
	const references = [];
	const seen = /* @__PURE__ */ new Set();
	const candidates = getSortedTypeNames(context);
	for (const typeName of candidates) {
		const emittedName = context.outTypeName(typeName);
		if (!new RegExp(`(^|[^\\w$])${escapeRegExp(emittedName)}(?=$|[^\\w$])`).test(source)) continue;
		if (seen.has(typeName)) continue;
		seen.add(typeName);
		references.push(typeName);
	}
	return references;
}
/** Normalize JSDoc output settings. */
function normalizeJsdocSettings(options = {}) {
	const jsdoc = options.jsdoc || {};
	const shorthand = jsdoc.shorthand === false ? {
		enabled: false,
		includeTypedefs: false,
		types: {}
	} : {
		enabled: typeof jsdoc.shorthand === "object" ? jsdoc.shorthand.enabled !== false : true,
		includeTypedefs: typeof jsdoc.shorthand === "object" ? jsdoc.shorthand.includeTypedefs !== false : true,
		types: {
			Object: "O",
			object: "O",
			String: "s",
			string: "s",
			Number: "n",
			number: "n",
			Boolean: "b",
			boolean: "b",
			BigInt: "bi",
			bigint: "bi",
			Symbol: "S",
			symbol: "S",
			unknown: "X",
			any: "x",
			Function: "F",
			function: "f",
			null: "N",
			...typeof jsdoc.shorthand === "object" ? jsdoc.shorthand.types : void 0
		}
	};
	const globals = jsdoc.globals || "none";
	return {
		includeGlobals: options.includeGlobals !== false,
		includeHeader: options.includeHeader === true,
		unknownType: options.unknownType || "unknown",
		typeNameSuffix: options.typeNameSuffix || "",
		sort: options.sort !== false,
		tags: {
			property: cleanTagName(jsdoc.tags?.property || "property"),
			argument: cleanTagName(jsdoc.tags?.argument || "param")
		},
		format: jsdoc.format || "compact",
		space: jsdoc.space === void 0 ? "\n" : jsdoc.space,
		shorthand,
		globals,
		importTypes: {
			enabled: jsdoc.importTypes?.enabled === true || globals === "importTypes",
			specifier: jsdoc.importTypes?.specifier || options.specifier || "",
			namespaceName: jsdoc.importTypes?.namespaceName || "Pkg",
			mode: jsdoc.importTypes?.mode || "namespace"
		}
	};
}
/** Remove a leading @ from a tag alias. */
function cleanTagName(tag) {
	return String(tag || "").replace(/^@+/, "") || "property";
}
function buildTypedefDefinition(input) {
	const { emittedName, kind, typeEntry, typeInfo, members, templateNames, ctx, settings } = input;
	const lines = [];
	appendRawDocLines(lines, typeEntry?.documentation || "");
	if (templateNames.length) lines.push(`@template ${templateNames.join(", ")}`);
	if (kind === "Enum") {
		const unknown = toSafeJsdocType(settings.unknownType, ctx);
		lines.push(`@typedef {${unknown}} ${emittedName}`);
		for (const member of members) {
			if (member.kind !== "EnumMember") continue;
			const doc = member.documentation ? ` - ${oneLine(member.documentation)}` : "";
			lines.push(`@${settings.tags.property} {${unknown}} ${member.label}${doc}`);
		}
		return {
			generic: templateNames.length > 0,
			lines
		};
	}
	if (kind === "TypeAlias") {
		const safeType = toSafeJsdocType(typeEntry?.type || extractTypeAliasType(typeEntry?.detail || typeInfo?.detail || ""), ctx);
		lines.push(`@typedef {${safeType}} ${emittedName}`);
		return {
			generic: templateNames.length > 0,
			lines
		};
	}
	const printableMembers = (settings.sort ? members.slice().sort((a, b) => a.label.localeCompare(b.label)) : members).filter((member) => {
		if (!member?.label) return false;
		if (kind === "Class" && member.isStatic) return false;
		if (member.label === "constructor") return false;
		if (member.label === "(call)") return false;
		if (member.label === "[index]") return false;
		return true;
	});
	if (shouldOmitObjectTypedefType(settings) && printableMembers.length > 0) lines.push(`@typedef ${emittedName}`);
	else lines.push(`@typedef {${aliasBasicType("Object", ctx)}} ${emittedName}`);
	for (const member of printableMembers) {
		const property = renderSafeProperty(member, ctx, settings);
		if (property) lines.push(property);
	}
	return {
		generic: templateNames.length > 0,
		lines
	};
}
/** Build import-type declarations instead of fake global runtime stubs. */
function buildImportTypeDefinitions(flat, originalTypeNames, settings) {
	if (!settings.importTypes?.enabled) return [];
	const specifier = settings.importTypes.specifier;
	if (!specifier) return [];
	if (settings.importTypes.mode === "namespace") return [{
		generic: false,
		lines: [`@typedef {import("${specifier}")} ${settings.importTypes.namespaceName}`]
	}];
	let globals = flat.filter((entry) => {
		return entry?.scope === "global" && !originalTypeNames.has(entry.label) && ["Variable", "Function"].includes(entry.kind);
	});
	if (settings.sort) globals = globals.slice().sort((a, b) => a.label.localeCompare(b.label));
	return globals.map((entry) => ({
		generic: false,
		lines: [`@typedef {import("${specifier}").${entry.label}} ${entry.label}${settings.typeNameSuffix}`]
	}));
}
/** Build global variable/function helper definitions. Off unless jsdoc.globals === "stubs". */
function buildGlobalDefinitions(flat, originalTypeNames, helpers) {
	const { settings, outTypeName } = helpers;
	if (settings.globals !== "stubs") return [];
	let globals = flat.filter((entry) => {
		return entry?.scope === "global" && !originalTypeNames.has(entry.label) && ["Variable", "Function"].includes(entry.kind);
	});
	if (settings.sort) globals = globals.slice().sort((a, b) => a.label.localeCompare(b.label));
	const ctx = {
		settings,
		unknownType: settings.unknownType,
		originalTypeNames,
		outTypeName,
		templateNames: /* @__PURE__ */ new Set(),
		functionUnknownType: "any"
	};
	return globals.map((entry) => {
		if (entry.kind === "Variable") {
			const safeType = toSafeJsdocType(entry.type, ctx);
			const lines = [];
			appendRawDocLines(lines, entry.documentation);
			lines.push(`@type {${safeType}}`);
			return {
				kind: "global-variable",
				generic: false,
				lines,
				code: `const ${entry.label} = undefined;`
			};
		}
		if (entry.kind === "Function") {
			const lines = [];
			const parsed = parseCallableDetail(entry.detail, entry.label);
			appendRawDocLines(lines, entry.documentation);
			for (const param of parsed.params) {
				const safeType = toSafeJsdocType(param.type, ctx);
				const name = param.optional ? `[${param.name}]` : param.name;
				lines.push(`@${settings.tags.argument} {${safeType}} ${name}`);
			}
			const returnType = toSafeJsdocType(entry.returnType || parsed.returnType || "void", ctx);
			if (returnType && returnType !== "void") lines.push(`@returns {${returnType}}`);
			const args = parsed.params.map((param) => param.name.replace(/^\.\.\./, "")).join(", ");
			return {
				kind: "global-function",
				generic: false,
				lines,
				code: `function ${entry.label}(${args}) {}`
			};
		}
		return null;
	}).filter(Boolean);
}
/** Render typedef/global definition objects to JSDoc source. */
function renderJsdocDefinitions(typedefDefs, globalDefs, settings) {
	const out = [];
	if (settings.includeHeader) out.push(renderJsdocBlock(["Generated JSDoc helper types."]));
	const shorthandDef = buildShorthandDefinition(settings);
	if (settings.format === "oneLine") {
		const rendered = [];
		if (shorthandDef) rendered.push(renderOneLineJsdocBlock(shorthandDef.lines));
		for (const def of typedefDefs) rendered.push(renderOneLineJsdocBlock(def.lines));
		for (const def of globalDefs) {
			rendered.push(renderOneLineJsdocBlock(def.lines));
			if (def.code) rendered.push(def.code);
		}
		return out.concat(rendered).join(spaceToRawSeparator(settings.space)).trimEnd();
	}
	if (settings.format === "verbose") {
		if (shorthandDef) out.push(renderJsdocBlock(shorthandDef.lines));
		for (const def of typedefDefs) out.push(renderJsdocBlock(def.lines));
		for (const def of globalDefs) {
			out.push(renderJsdocBlock(def.lines));
			if (def.code) out.push(def.code);
		}
		return out.join("\n\n").trimEnd();
	}
	const compactTypedefs = typedefDefs.filter((def) => !def.generic);
	const genericTypedefs = typedefDefs.filter((def) => def.generic);
	const groupedDefs = shorthandDef ? [shorthandDef, ...compactTypedefs] : compactTypedefs;
	if (groupedDefs.length) out.push(renderJsdocBlock(joinDefinitionLines(groupedDefs, settings.space)));
	for (const def of genericTypedefs) out.push(renderJsdocBlock(def.lines));
	for (const def of globalDefs) {
		out.push(renderJsdocBlock(def.lines));
		if (def.code) out.push(def.code);
	}
	return out.join("\n\n").trimEnd();
}
/** Build default shorthand aliases. */
function buildShorthandDefinition(settings) {
	if (!settings.shorthand?.enabled || !settings.shorthand?.includeTypedefs) return null;
	const aliases = settings.shorthand.types || {};
	return {
		generic: false,
		lines: [
			["Object", aliases.Object || "O"],
			["String", aliases.String || "s"],
			["Number", aliases.Number || "n"],
			["boolean", aliases.boolean || "b"],
			["bigint", aliases.bigint || "bi"],
			["Symbol", aliases.Symbol || "S"],
			["unknown", aliases.unknown || "X"],
			["any", aliases.any || "x"],
			["Function", aliases.Function || "F"],
			["function", aliases.function || "f"],
			[`(...args:${aliases.any || "x"}[]) => Promise<${aliases.unknown || "X"}>`, "AF"],
			["null", aliases.null || "N"]
		].map(([type, name]) => `@typedef {${type}} ${name}`)
	};
}
function shouldOmitObjectTypedefType(settings) {
	return settings.format === "compact" || settings.format === "oneLine";
}
function joinDefinitionLines(defs, space) {
	const out = [];
	for (let i = 0; i < defs.length; i++) {
		const def = defs[i];
		if (!def) continue;
		if (i > 0) out.push(...spaceToDocLines(space));
		out.push(...def.lines);
	}
	return out;
}
function spaceToDocLines(space) {
	if (space === 0 || space === "" || space === false || space === null) return [];
	if (typeof space === "number") return Array.from({ length: Math.max(0, space) }, () => "");
	if (typeof space === "string") {
		if (space === "\n") return [""];
		const parts = space.split("\n");
		return parts.length === 1 ? [space] : parts.map((part) => part.trimEnd());
	}
	return [""];
}
function spaceToRawSeparator(space) {
	if (space === 0 || space === "" || space === false || space === null) return "";
	if (typeof space === "number") return "\n".repeat(Math.max(0, space));
	if (typeof space === "string") return space;
	return "\n";
}
function renderJsdocBlock(lines) {
	return [
		"/**",
		...lines.map((line) => line ? ` * ${line}` : " *"),
		" */"
	].join("\n");
}
function renderOneLineJsdocBlock(lines) {
	return `/** ${lines.map((line) => String(line || "").trim()).filter(Boolean).join(" ")} */`;
}
function renderSafeProperty(member, ctx, settings) {
	const doc = member.documentation ? ` - ${oneLine(member.documentation)}` : "";
	if (member.kind === "Method" || member.kind === "Function") {
		const arrowType = callableEntryToSafeArrowType(member, ctx);
		return `@${settings.tags.property} {${arrowType}} ${member.label}${doc}`;
	}
	const safeType = toSafeJsdocType(member.type || extractPropertyType(member.detail), ctx);
	return `@${settings.tags.property} {${safeType}} ${member.label}${doc}`;
}
function callableEntryToSafeArrowType(entry, ctx) {
	const parsed = parseCallableDetail(entry.detail, entry.label);
	const params = parsed.params.map((param, index) => renderArrowParam(param, index, ctx));
	const returnType = toSafeArrowType(entry.returnType || parsed.returnType || "void", ctx);
	return `(${params.join(",")}) => ${returnType}`;
}
function renderArrowParam(param, index, ctx) {
	const rest = param.rest || String(param.name || "").startsWith("...");
	const cleanName = sanitizeParamName(String(param.name || "").replace(/^\.\.\./, ""), index);
	let type = toSafeArrowType(param.type || "*", ctx);
	if (rest) {
		if (!type.endsWith("[]")) type = `${type}[]`;
		return `...${cleanName}:${type}`;
	}
	return `${cleanName}${param.optional ? "?" : ""}:${type}`;
}
function sanitizeParamName(name, index) {
	const cleaned = String(name || "").replace(/[^\w$]/g, "").trim();
	if (!cleaned) return `arg${index + 1}`;
	if (/^\d/.test(cleaned)) return `arg${index + 1}`;
	return cleaned;
}
function toSafeArrowType(type, ctx) {
	const value = toSafeJsdocType(type, ctx);
	const unknownAlias = aliasBasicType(ctx.unknownType, ctx);
	if (!value || value === "*" || value === "unknown" || value === unknownAlias) return aliasBasicType(ctx.functionUnknownType || "any", ctx);
	return value;
}
/** Convert a TypeScript-ish type string to safe JSDoc type syntax. */
function toSafeJsdocType(type, ctx = {}) {
	const unknownType = ctx.unknownType || "unknown";
	const originalTypeNames = ctx.originalTypeNames || /* @__PURE__ */ new Set();
	const outTypeName = ctx.outTypeName || ((name) => name);
	const templateNames = ctx.templateNames || /* @__PURE__ */ new Set();
	let value = String(type || "").trim();
	if (!value) return aliasBasicType(unknownType, ctx);
	value = value.replace(/\bdeclare\s+/g, "").replace(/\bexport\s+/g, "").replace(/\breadonly\s+/g, "").replace(/\s+/g, " ").replace(/;$/, "").trim();
	if (!value) return aliasBasicType(unknownType, ctx);
	if (value.includes("typeof this") || value.includes("this &") || value.includes("Constructor<") || value.includes("UnionToIntersection<") || value.includes("ReturnTypeOf<") || value.includes("import(") || value.includes("infer ")) return aliasBasicType(unknownType, ctx);
	if (splitTopLevel(value, "&").length > 1) return aliasBasicType(unknownType, ctx);
	if (/^["'`].*["'`]$/.test(value)) return aliasBasicType("string", ctx);
	if (/^\d+(\.\d+)?$/.test(value)) return aliasBasicType("number", ctx);
	if (value === "true" || value === "false") return aliasBasicType("boolean", ctx);
	if (/^\{.*\}$/.test(value) && value.includes(":")) return aliasBasicType("Object", ctx);
	const arrow = parseArrowFunctionType(value);
	if (arrow && isFullArrowType(value)) {
		const fullCtx = ctx;
		return `(${arrow.params.map((param, index) => renderArrowParam(param, index, fullCtx)).join(",")}) => ${toSafeArrowType(arrow.returnType, fullCtx)}`;
	}
	const unionParts = splitTopLevel(value, "|");
	if (unionParts.length > 1) {
		const safeParts = unionParts.map((part) => toSafeJsdocType(part, ctx)).filter(Boolean);
		if (safeParts.includes(aliasBasicType(unknownType, ctx))) return aliasBasicType(unknownType, ctx);
		return Array.from(new Set(safeParts)).join("|");
	}
	if (value.endsWith("[]")) return `${toSafeJsdocType(value.slice(0, -2).trim(), ctx)}[]`;
	const generic = parseGenericType(value);
	if (generic) {
		const name = generic.name;
		if (name === "Array" || name === "ReadonlyArray") return `${toSafeJsdocType(generic.args[0] || unknownType, ctx)}[]`;
		if (name === "Promise") return `Promise<${toSafeJsdocType(generic.args[0] || unknownType, ctx)}>`;
		if (name === "Record") return aliasBasicType("Object", ctx);
		if (templateNames.has(name)) return `${name}<${generic.args.map((arg) => toSafeGenericArgument(arg, ctx)).join(",")}>`;
		if (originalTypeNames.has(name)) {
			const safeArgs = generic.args.map((arg) => toSafeGenericArgument(arg, ctx));
			return `${outTypeName(name)}<${safeArgs.join(",")}>`;
		}
		return aliasBasicType(unknownType, ctx);
	}
	if (templateNames.has(value)) return value;
	if (isPrimitiveOrBuiltin(value)) return aliasBasicType(value, ctx);
	if (originalTypeNames.has(value)) {
		const requiredCount = getRequiredTemplateCount(value, ctx);
		if (requiredCount > 0) {
			const fallbackArgs = Array.from({ length: requiredCount }, () => aliasBasicType(ctx.functionUnknownType || "any", ctx));
			return `${outTypeName(value)}<${fallbackArgs.join(",")}>`;
		}
		return outTypeName(value);
	}
	return aliasBasicType(unknownType, ctx);
}
function isFullArrowType(value) {
	const arrowIndex = findTopLevelArrow(value);
	if (arrowIndex < 0) return false;
	const left = value.slice(0, arrowIndex).trim();
	return left.startsWith("(") || left.includes(":") || left.includes("...");
}
function toSafeGenericArgument(arg, ctx) {
	const value = toSafeJsdocType(arg, ctx);
	const unknown = aliasBasicType(ctx.unknownType || "unknown", ctx);
	if (!value || value === "*" || value === "unknown" || value === unknown) return aliasBasicType(ctx.functionUnknownType || "any", ctx);
	return value;
}
function getRequiredTemplateCount(typeName, ctx) {
	if (!ctx.originalTypeNames?.has(typeName)) return 0;
	const entry = ctx.settings?.__typeEntries?.get(typeName);
	if (!entry) return 0;
	return extractTemplateNames(typeName, entry.typeEntry, entry.typeInfo).length;
}
function aliasBasicType(type, ctx = {}) {
	const aliases = ctx.settings?.shorthand?.enabled ? ctx.settings.shorthand.types : null;
	if (!aliases) return type;
	const key = String(type || "").trim();
	return aliases[key] ?? key;
}
function extractTemplateNames(typeName, typeEntry, typeInfo) {
	const detail = String(typeEntry?.detail || typeInfo?.detail || "");
	const escaped = escapeRegExp(typeName);
	const patterns = [
		new RegExp(`\\binterface\\s+${escaped}\\s*<([^>]+)>`),
		new RegExp(`\\bclass\\s+${escaped}\\s*<([^>]+)>`),
		new RegExp(`\\btype\\s+${escaped}\\s*<([^>]+)>`)
	];
	for (const pattern of patterns) {
		const match = detail.match(pattern);
		if (!match?.[1]) continue;
		return splitTopLevel(match[1], ",").map((part) => part.replace(/\s+extends\s+[\s\S]*$/g, "").replace(/\s*=\s*[\s\S]*$/g, "").trim()).filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
	}
	return [];
}
function isPrimitiveOrBuiltin(value) {
	return [
		"*",
		"any",
		"unknown",
		"void",
		"undefined",
		"null",
		"never",
		"string",
		"String",
		"number",
		"Number",
		"boolean",
		"Boolean",
		"bigint",
		"BigInt",
		"symbol",
		"Symbol",
		"object",
		"Object",
		"Function",
		"function",
		"Array",
		"Date",
		"RegExp",
		"Error",
		"Promise"
	].includes(value);
}
function parseGenericType(value) {
	const lt = value.indexOf("<");
	if (lt < 0 || !value.endsWith(">")) return null;
	const name = value.slice(0, lt).trim();
	if (!/^[A-Za-z_$][\w$]*$/.test(name)) return null;
	return {
		name,
		args: splitTopLevel(value.slice(lt + 1, -1), ",")
	};
}
function parseArrowFunctionType(value) {
	const arrowIndex = findTopLevelArrow(value);
	if (arrowIndex < 0) return null;
	let left = value.slice(0, arrowIndex).trim();
	const right = value.slice(arrowIndex + 2).trim();
	if (left.startsWith("(") && left.endsWith(")")) left = left.slice(1, -1).trim();
	return {
		params: parseParams(left),
		returnType: right
	};
}
function findTopLevelArrow(source) {
	let depth = 0;
	let quote = "";
	for (let i = 0; i < source.length - 1; i++) {
		const char = source[i];
		const next = source[i + 1];
		const prev = source[i - 1];
		if (quote) {
			if (char === quote && prev !== "\\") quote = "";
			continue;
		}
		if (char === "'" || char === "\"" || char === "`") {
			quote = char;
			continue;
		}
		if (char === "(" || char === "<" || char === "{" || char === "[") depth++;
		else if (char === ")" || char === ">" || char === "}" || char === "]") depth = Math.max(0, depth - 1);
		if (depth === 0 && char === "=" && next === ">") return i;
	}
	return -1;
}
function parseCallableDetail(detail, expectedName = "") {
	const source = String(detail || "").trim();
	const fallback = {
		name: expectedName || "",
		params: [],
		returnType: ""
	};
	if (!source) return fallback;
	const compact = source.replace(/\s+/g, " ").replace(/;$/, "").trim();
	const openParenIndex = compact.indexOf("(");
	if (openParenIndex < 0) return fallback;
	const closeParenIndex = findMatchingParen(compact, openParenIndex);
	if (closeParenIndex < 0) return fallback;
	const inside = compact.slice(openParenIndex + 1, closeParenIndex).trim();
	const after = compact.slice(closeParenIndex + 1).trim();
	let returnType = "";
	if (after.startsWith(":")) returnType = after.slice(1).trim();
	else if (after.startsWith("=>")) returnType = after.slice(2).trim();
	returnType = returnType.replace(/[;{].*$/, "").trim();
	return {
		name: expectedName || "",
		params: parseParams(inside),
		returnType
	};
}
function parseParams(paramSource) {
	if (!String(paramSource || "").trim()) return [];
	return splitTopLevel(paramSource, ",").map((rawParam, index) => {
		let raw = rawParam.trim();
		const rest = raw.startsWith("...");
		if (rest) raw = raw.slice(3).trim();
		raw = raw.replace(/=.*$/, "").trim();
		const colonIndex = findTopLevelChar(raw, ":");
		let name = "";
		let type = "";
		if (colonIndex >= 0) {
			name = raw.slice(0, colonIndex).trim();
			type = raw.slice(colonIndex + 1).trim();
		} else {
			name = raw.trim();
			type = "*";
		}
		const optional = /\?$/.test(name);
		name = name.replace(/\?$/, "").replace(/[^\w$]/g, "").trim();
		if (!name) name = `arg${index + 1}`;
		if (rest) name = `...${name}`;
		return {
			name,
			type: type || "*",
			optional,
			rest
		};
	});
}
function extractPropertyType(detail) {
	const text = String(detail || "").trim();
	const colonIndex = findTopLevelChar(text, ":");
	if (colonIndex < 0) return "";
	return text.slice(colonIndex + 1).replace(/[;=].*$/, "").trim();
}
function extractTypeAliasType(detail) {
	const text = String(detail || "").trim();
	const equalsIndex = findTopLevelChar(text, "=");
	if (equalsIndex < 0) return "";
	return text.slice(equalsIndex + 1).replace(/;$/, "").trim();
}
function splitTopLevel(source, delimiter) {
	const out = [];
	let depth = 0;
	let quote = "";
	let start = 0;
	for (let i = 0; i < source.length; i++) {
		const char = source[i];
		const prev = source[i - 1];
		if (quote) {
			if (char === quote && prev !== "\\") quote = "";
			continue;
		}
		if (char === "'" || char === "\"" || char === "`") {
			quote = char;
			continue;
		}
		if (char === "(" || char === "<" || char === "{" || char === "[") depth++;
		else if (char === ")" || char === ">" || char === "}" || char === "]") depth = Math.max(0, depth - 1);
		else if (depth === 0 && char === delimiter) {
			out.push(source.slice(start, i).trim());
			start = i + 1;
		}
	}
	out.push(source.slice(start).trim());
	return out.filter(Boolean);
}
function findTopLevelChar(source, target) {
	let depth = 0;
	let quote = "";
	for (let i = 0; i < source.length; i++) {
		const char = source[i];
		const prev = source[i - 1];
		if (quote) {
			if (char === quote && prev !== "\\") quote = "";
			continue;
		}
		if (char === "'" || char === "\"" || char === "`") {
			quote = char;
			continue;
		}
		if (char === "(" || char === "<" || char === "{" || char === "[") depth++;
		else if (char === ")" || char === ">" || char === "}" || char === "]") depth = Math.max(0, depth - 1);
		else if (depth === 0 && char === target) return i;
	}
	return -1;
}
function findMatchingParen(source, openIndex) {
	let depth = 0;
	let quote = "";
	for (let i = openIndex; i < source.length; i++) {
		const char = source[i];
		const prev = source[i - 1];
		if (quote) {
			if (char === quote && prev !== "\\") quote = "";
			continue;
		}
		if (char === "'" || char === "\"" || char === "`") {
			quote = char;
			continue;
		}
		if (char === "(") depth++;
		else if (char === ")") {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1;
}
function appendRawDocLines(lines, documentation) {
	const text = cleanDoc(documentation);
	if (!text) return;
	for (const line of text.split("\n")) lines.push(line);
}
function cleanDoc(value) {
	return String(value || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function oneLine(value) {
	return cleanDoc(value).replace(/\s+/g, " ").trim();
}
function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//#endregion
//#region src/markdown.ts
var markdown_exports = /* @__PURE__ */ __exportAll({ markdownCodeBlock: () => markdownCodeBlock });
/** Render a markdown code block without nested triple-backtick problems. */
function markdownCodeBlock(code, lang = "js") {
	return "~~~~" + lang + "\n" + String(code || "") + "\n~~~~";
}
//#endregion
//#region src/monaco.ts
var monaco_exports = /* @__PURE__ */ __exportAll({ toMonacoSuggestions: () => toMonacoSuggestions });
/** Convert completion entries into Monaco CompletionItem objects. */
function toMonacoSuggestions(monaco, entries, range) {
	const kindMap = {
		Function: monaco.languages.CompletionItemKind.Function,
		Method: monaco.languages.CompletionItemKind.Method,
		Variable: monaco.languages.CompletionItemKind.Variable,
		Property: monaco.languages.CompletionItemKind.Property,
		Interface: monaco.languages.CompletionItemKind.Interface,
		Class: monaco.languages.CompletionItemKind.Class,
		TypeAlias: monaco.languages.CompletionItemKind.Struct,
		Enum: monaco.languages.CompletionItemKind.Enum,
		EnumMember: monaco.languages.CompletionItemKind.EnumMember,
		Constructor: monaco.languages.CompletionItemKind.Constructor,
		Export: monaco.languages.CompletionItemKind.Module
	};
	return entries.map((entry) => ({
		label: entry.label,
		kind: kindMap[entry.kind] || monaco.languages.CompletionItemKind.Text,
		insertText: entry.insertText,
		insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
		detail: entry.detail,
		documentation: entry.documentation,
		range
	}));
}
//#endregion
//#region src/remote-esm-import/lib/dtsConverter.ts
async function getDtsConverter(tsUrl) {
	if (remoteEsmVm.converter) return remoteEsmVm.converter;
	remoteEsmVm.converter = createDtsCompletionConverter(await loadTypeScript(tsUrl));
	return remoteEsmVm.converter;
}
//#endregion
//#region src/remote-esm-import/lib/packageCache.ts
function importWithPackageCache(key, factory) {
	const cached = remoteEsmVm.package.get(key);
	if (cached) return cached;
	const promise = factory().catch((error) => {
		remoteEsmVm.package.delete(key);
		throw error;
	});
	remoteEsmVm.package.set(key, promise);
	return promise;
}
//#endregion
//#region src/remote-esm-import/lib/typeExpression.ts
function getLocalExportTypeName(match, typeNameSuffix = "") {
	return `${match.entry.label || match.key}${typeNameSuffix}`;
}
function getTypedBindingTypeExpression(match, options = {}) {
	const localTypeName = options.typeName || getLocalExportTypeName(match, options.typeNameSuffix || "");
	const typeSource = options.typeSource || (match.entry.kind === "Class" ? "constructor" : "local");
	if (typeSource === "import" && options.importSpecifier) return `typeof import("${escapeJsString(options.importSpecifier)}")${exportTypeAccessor(match.key)}`;
	if (typeSource === "constructor" && match.entry.kind === "Class") {
		const constructorType = getConstructorTypeExpression(match, localTypeName, options.typeNameSuffix || "");
		if (constructorType) return constructorType;
	}
	return localTypeName || match.entry.label || "unknown";
}
function getConstructorTypeExpression(match, instanceTypeName, typeNameSuffix = "") {
	const constructorEntry = match.type?.members.find((member) => member.kind === "Constructor");
	if (!constructorEntry) return "";
	return `new (${parseCallableDetail(constructorEntry.detail, "constructor").params.map((param, index) => {
		const rest = param.rest || param.name.startsWith("...");
		const name = sanitizeBindingName(param.name.replace(/^\.\.\./, "") || `arg${index + 1}`);
		const type = toLocalParsedTypeExpression(param.type || "x", typeNameSuffix);
		const optional = param.optional ? "?" : "";
		return rest ? `...${name}:${type}[]` : `${name}${optional}:${type}`;
	}).join(",")}) => ${instanceTypeName}`;
}
function toLocalParsedTypeExpression(type, typeNameSuffix = "") {
	let value = String(type || "x").trim();
	if (!value) return "x";
	value = value.replace(/\bObject\b/g, "O").replace(/\bString\b/g, "s").replace(/\bstring\b/g, "s").replace(/\bNumber\b/g, "n").replace(/\bnumber\b/g, "n").replace(/\bBoolean\b/g, "b").replace(/\bboolean\b/g, "b").replace(/\bunknown\b/g, "X").replace(/\bany\b/g, "x");
	if (!typeNameSuffix) return value;
	return value.replace(/\b[A-Z][A-Za-z0-9_$]*\b/g, (name) => {
		if ([
			"O",
			"String",
			"Number",
			"Boolean",
			"Promise",
			"Array",
			"Date",
			"RegExp",
			"Error",
			"Function"
		].includes(name)) return name;
		return name.endsWith(typeNameSuffix) ? name : `${name}${typeNameSuffix}`;
	});
}
//#endregion
//#region src/remote-esm-import/lib/typedBindings.ts
function buildRemoteEsmImportMatches(moduleObject, completions, options = {}) {
	if (!moduleObject || typeof moduleObject !== "object" && typeof moduleObject !== "function") return {};
	const globals = Array.isArray(completions?.byScope?.global) ? completions.byScope.global : [];
	const types = completions?.types && typeof completions.types === "object" ? completions.types : {};
	const matches = {};
	for (const key of Object.keys(moduleObject)) {
		const entry = globals.find((candidate) => candidate?.label === key);
		if (!entry) continue;
		const type = types[entry.label];
		const match = {
			key,
			value: moduleObject[key],
			entry
		};
		if (type) {
			match.type = type;
			if (typeof type.toJsdoc === "function") match.toJsdoc = type.toJsdoc.bind(type);
		}
		match.toTypedBinding = (bindingOptions) => remoteEsmImportMatchToTypedBinding(match, {
			...options,
			...normalizeTypedBindingOptions(bindingOptions)
		});
		match.toGlobal = match.toTypedBinding;
		matches[key] = match;
	}
	return matches;
}
function remoteEsmImportMatchToTypedBinding(match, options = {}) {
	const out = [];
	if (options.includeTypedef !== false && typeof match.toJsdoc === "function") {
		const jsdoc = match.toJsdoc(options.jsdoc);
		if (jsdoc) out.push(jsdoc);
	}
	out.push(renderTypedBinding({
		localName: options.localName || sanitizeBindingName(match.key),
		moduleName: options.moduleName || "module",
		exportKey: match.key,
		typeExpression: getTypedBindingTypeExpression(match, options)
	}));
	return out.join("\n\n");
}
function renderTypedBinding(input) {
	return [`/** @type {${input.typeExpression}} */`, `const ${input.localName} = ${input.moduleName}${runtimePropertyAccessor(input.exportKey)};`].join("\n");
}
function normalizeTypedBindingOptions(options) {
	return typeof options === "string" ? { localName: options } : options || {};
}
//#endregion
//#region src/remote-esm-import/index.ts
/**
* Main public API. Imports a remote ESM runtime module, loads its declaration graph, converts it to
* completion JSON + safe JSDoc, and caches everything in virtual memory.
*
* Accepts any of:
* - "zod"
* - "zod@4.4.3"
* - "@octokit/core"
* - "@octokit/core@7.0.6"
* - "github:user/repo#commit"
* - "gh:user/repo#commit"
* - authenticated private GitHub repositories via options.github
* - "https://esm.sh/@octokit/core@7.0.6"
* - { runtimeUrl, dtsUrl, specifier }
*/
async function remoteEsmImport(input, options = {}) {
	const target = await resolvePrivateGitHubTarget(input, options) || normalizeRemoteEsmTarget(input, options);
	const { tsUrl = DEFAULT_TYPESCRIPT_URL, maxDepth = 5, maxFiles = 80, includeBareDtsImports = true, typeNameSuffix = "", unknownType, includeHeader = false, log = true } = options;
	return await importWithPackageCache(JSON.stringify({
		input,
		target,
		tsUrl,
		maxDepth,
		maxFiles,
		includeBareDtsImports,
		typeNameSuffix,
		unknownType,
		includeHeader,
		jsdoc: options.jsdoc || null
	}), async () => {
		const [moduleObject, dtsUrl, converter] = await Promise.all([
			importModuleCached(target.runtimeUrl, options),
			resolveDeclarationUrl(target, options),
			getDtsConverter(tsUrl)
		]);
		const dtsGraph = await loadDtsGraph(dtsUrl, {
			...options,
			maxDepth,
			maxFiles,
			includeBareDtsImports
		});
		const combinedDts = dtsGraph.files.map((file) => [
			"",
			`/* ===== ${file.url} ===== */`,
			file.text
		].join("\n")).join("\n");
		const completions = converter.convertText(combinedDts, { fileName: `${target.specifier || "remote"}.virtual.d.ts` });
		const jsdocOptions = {
			...options,
			specifier: options.jsdoc?.importTypes?.specifier || target.specifier,
			includeGlobals: true,
			includeHeader,
			typeNameSuffix
		};
		if (unknownType !== void 0) jsdocOptions.unknownType = unknownType;
		attachCompletionTypeJsdoc(completions, jsdocOptions);
		const jsdoc = completionsToSafeJsdoc(completions, jsdocOptions);
		const result = {
			input,
			specifier: target.specifier,
			libUrl: target.runtimeUrl,
			runtimeUrl: target.runtimeUrl,
			metaUrl: target.metaUrl,
			dtsUrl,
			module: moduleObject,
			dtsGraph,
			completions,
			imports: buildRemoteEsmImportMatches(moduleObject, completions, {
				importSpecifier: target.runtimeUrl,
				typeNameSuffix
			}),
			jsdoc,
			memory: remoteEsmVm,
			pick(name, fallback) {
				if (moduleObject && name in moduleObject) return moduleObject[name];
				if (fallback !== void 0) return fallback;
				return moduleObject?.default ?? moduleObject;
			},
			asAny(value) {
				return value;
			}
		};
		if (log) {
			console.info("remoteEsmImport runtime:", target.runtimeUrl);
			console.info("remoteEsmImport types:", dtsUrl);
			console.info("remoteEsmImport d.ts files:", dtsGraph.files.map((file) => file.url));
			if (dtsGraph.failed.length) console.warn("remoteEsmImport d.ts fetch failures:", dtsGraph.failed);
		}
		return result;
	});
}
/** Backwards-compatible alias for the earlier single-file API name. */
const importCdnPackageWithTypes = remoteEsmImport;
//#endregion
//#region src/temp-storage/getQuota.ts
async function getStorageQuota() {
	const results = {};
	if (navigator.storage?.estimate) try {
		const estimate = await navigator.storage.estimate();
		const { usage = 0, quota = 0 } = estimate;
		results.storageManager = {
			usageBytes: estimate.usage,
			quotaBytes: estimate.quota,
			usageMiB: usage / 1024 ** 2,
			quotaMiB: quota / 1024 ** 2,
			availableMiB: (quota - usage) / 1024 ** 2,
			availableGiB: (quota - usage) / 1024 ** 2 / 10240,
			usageDetails: estimate.usageDetails ?? null
		};
	} catch (error) {
		results.storageManagerError = {
			name: error?.name,
			message: error?.message
		};
	}
	if (navigator.webkitTemporaryStorage?.queryUsageAndQuota) try {
		results.legacyTemporaryStorage = await new Promise((resolve, reject) => {
			navigator.webkitTemporaryStorage.queryUsageAndQuota((usage, quota) => {
				resolve({
					usageBytes: usage,
					quotaBytes: quota,
					usageMiB: usage / 1024 ** 2,
					quotaMiB: quota / 1024 ** 2,
					availableMiB: (quota - usage) / 1024 ** 2,
					availableGiB: (quota - usage) / 1024 ** 2 / 10240
				});
			}, reject);
		});
	} catch (error) {
		results.legacyTemporaryStorageError = {
			name: error?.name,
			message: error?.message
		};
	}
	return results;
}
//#endregion
//#region src/temp-storage/index.ts
var temp_storage_default = getStorageQuota;
//#endregion
//#region src/types.ts
var types_exports = /* @__PURE__ */ __exportAll({});
//#endregion
//#region src/index.ts
const Src = {
	Core: core_default,
	RemoteEsmImport: importCdnPackageWithTypes,
	TempStorage: temp_storage_default,
	BliCache: bli_cache_default
};
var src_default = {
	Src,
	...Src,
	cache: cache_exports,
	converter: converter_exports,
	dtsGraph: dtsGraph_exports,
	github: github_exports,
	jsdoc: jsdoc_exports,
	markdown: markdown_exports,
	monaco: monaco_exports,
	network: network_exports,
	types: types_exports,
	url: url_exports,
	$import_meta: import.meta
};
//#endregion
export { bli_cache_default as BliCache, core_default as Core, DEFAULT_OCTOKIT_URL, DEFAULT_TYPESCRIPT_URL, getStorageQuota as GetStorageQuota, PRIVATE_GITHUB_PROTOCOL, importCdnPackageWithTypes as RemoteEsmImport, importCdnPackageWithTypes, Src, string_exports as StringUtils, TYPESCRIPT_VERSION, temp_storage_default as TempStorage, aliasBasicType, appendQuery, appendRawDocLines, attachCompletionTypeJsdoc, buildGlobalDefinitions, buildImportTypeDefinitions, buildRemoteEsmImportMatches, buildShorthandDefinition, cache_exports as cache, callableEntryToSafeArrowType, cleanDoc, cleanTagName, clearRemoteEsmVm, completionTypeToSafeJsdoc, completionsToSafeJsdoc, converter_exports as converter, createDtsCompletionConverter, createGitHubVirtualUrl, src_default as default, dtsGraph_exports as dtsGraph, escapeJsString, escapeRegExp, esmMetaUrl, esmUrl, expandDtsCandidates, exportTypeAccessor, extractDtsImportSpecifiers, extractPropertyType, extractTemplateNames, extractTypeAliasType, fetchGitHubFile, fetchGitHubVirtualText, findMatchingParen, findTopLevelArrow, findTopLevelChar, firstWorkingDtsCandidate, getConstructorTypeExpression, getDtsConverter, getJson, getLocalExportTypeName, getRequiredTemplateCount, getText, getTypedBindingTypeExpression, github_exports as github, hasPrivateGitHubTransport, importModuleCached, importWithPackageCache, inferSpecifierFromUrl, isAbsoluteUrl, isGitHubVirtualUrl, isHttpUrl, isIdentifierName, isPrimitiveOrBuiltin, joinDefinitionLines, jsdoc_exports as jsdoc, loadDtsGraph, loadTypeScript, markdown_exports as markdown, markdownCodeBlock, mergeJsdocOptions, monaco_exports as monaco, network_exports as network, normalizeJsdocSettings, normalizePackageSpecifier, normalizeRemoteEsmTarget, normalizeTypedBindingOptions, oneLine, parseArrowFunctionType, parseCallableDetail, parseGenericType, parseGitHubSpecifier, parseGitHubVirtualUrl, parseParams, propertyAccessor, remoteEsmImport, remoteEsmImportMatchToTypedBinding, remoteEsmVm, renderArrowParam, renderJsdocBlock, renderJsdocDefinitions, renderOneLineJsdocBlock, renderSafeProperty, renderTypedBinding, resolveDeclarationUrl, resolveDtsImport, resolveGitHubVirtualImport, resolvePrivateGitHubTarget, resolveTypeScriptUrl, runtimePropertyAccessor, sanitizeBindingName, sanitizeParamName, shouldOmitObjectTypedefType, spaceToDocLines, spaceToRawSeparator, splitTopLevel, toAbsoluteCdnUrl, toLocalParsedTypeExpression, toMonacoSuggestions, toSafeArrowType, toSafeGenericArgument, toSafeJsdocType, types_exports as types, url_exports as url, vmMemo };
