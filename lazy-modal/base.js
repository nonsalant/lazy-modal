import { createStylesheet, looksLikeCssText, processPlaceholders, executeScripts, camelToKebab } from './base-utils.js';

// Get the component path from the URL query parameter
const COMPONENT_PATH = new URL(import.meta.url).searchParams.get('path');

// Track added stylesheets globally to prevent duplicates across all component instances
globalThis._addedStylesheets ??= new Map(); // Map of assetHost -> Set of CSS texts
globalThis._cssLocks ??= new Map(); // Map of assetHost -> Promise (lock)

export class Base extends HTMLElement {
    static enableShadowRoot = false;
    static styles = [];
    static baseStyle = '.dom-root { display: contents; }';

    // https://hawkticehurst.com/2024/05/bring-your-own-base-class/#:~:text=class%20BaseElement,-extends%20HTMLElement%20%7Bconstructor
    constructor() {
        super();

        // Attach shadow root if enabled and not already present (via declarative shadow DOM)
        const needsShadow = this.constructor.enableShadowRoot && !this.shadowRoot;
        if (needsShadow) {
            this.attachShadow({ mode: 'open' });
            this.shadowRoot.innerHTML = `<div class="dom-root"></div>`;
        }

        // Current shadow root or the first parent shadow root or 'document':
        this.assetHost = this.shadowRoot ?? this.getRootNode();
        // console.log(this.constructor.name, this.assetHost);

        if (this.shadowRoot) {
            this.domRoot = this.shadowRoot.firstElementChild;
            this.domRoot.insertAdjacentHTML('beforeend', this.innerHTML);
        } else this.domRoot = this;

        // Use a string key for the Map instead of the object reference
        const assetHostKey = this.assetHost === document ? 'document' : this.assetHost;
        // Initialize Set for this assetHost if not present
        if (!globalThis._addedStylesheets.has(assetHostKey)) {
            // console.log('Creating new Set for:', assetHostKey);
            globalThis._addedStylesheets.set(assetHostKey, new Set());
        } else {
            // console.log('Using existing Set, current size:', globalThis._addedStylesheets.get(assetHostKey).size);
        }
        this._assetHostKey = assetHostKey;
    }

    disconnectedCallback() { this.disconnected(); }

    connectedCallback() {
        this.connected();
        if (this.initialized) return;
        this.initialized = true;
        this.init();
    }

    async init() {
        await this.addCss();

        const markup = await this.render();
        const beforeMarkup = await this.renderBefore();
        const processedBeforeHtml = processPlaceholders(beforeMarkup, this);
        const processedHtml = processPlaceholders(markup, this); // or: processPlaceholders(markup, { myValue: 'yoo' });

        // this.domRoot.prepend(createFragment(processedBeforeHtml));
        // this.domRoot.appendChild(createFragment(processedHtml)); // registers custom elements too early

        this.domRoot.insertAdjacentHTML('afterbegin', processedBeforeHtml);
        this.domRoot.insertAdjacentHTML('beforeend', processedHtml); // note: this doesn't execute scripts

        executeScripts(this.domRoot);

        await this.afterRender();
    }

    disconnected() { }
    connected() { }
    async afterRender() { }
    async render() { return ''; }
    async renderBefore() { return ''; }

    async addCss() {
        const styles = [...this.constructor.styles, this.constructor.baseStyle];
        const cssTexts = await this.css(styles);

        // for (const cssText of cssTexts) {
        //     const processedCssText = processPlaceholders(cssText, this);
        //     const stylesheet = await createStylesheet(processedCssText);
        //     this.assetHost.adoptedStyleSheets?.push(stylesheet);
        // }

        // Wait for any pending CSS additions for this assetHost
        while (globalThis._cssLocks.get(this._assetHostKey)) {
            await globalThis._cssLocks.get(this._assetHostKey);
        }

        // Create a lock promise
        let releaseLock;
        const lockPromise = new Promise(resolve => { releaseLock = resolve; });
        globalThis._cssLocks.set(this._assetHostKey, lockPromise);

        try {
            const addedStylesheets = globalThis._addedStylesheets.get(this._assetHostKey);
            // console.log('addCss:', this.constructor.name, 'Set size:', addedStylesheets.size);
            let index = 0;

            for (const cssText of cssTexts) {
                // Check if this CSS source is already applied BEFORE processing
                if (addedStylesheets.has(cssText)) {
                    // console.log('✓ Stylesheet already added, skipping duplicate.');
                    continue;
                }

                // console.log('Adding new stylesheet (first 50 chars):', cssText.substring(0, 50));
                const tagName = camelToKebab(this.constructor.name);
                const filename = styles[index];
                index++;
                // if filename ends in .scoped.css
                // !
                let processedCssText = processPlaceholders(cssText, this);
                // Scoped stylesheet handling
                if (filename.endsWith('.scoped.css')) {
                    if (this.shadowRoot) {
                        // Scoped to shadow root: wrap in :host
                        processedCssText = `:host { ${processedCssText} }`;
                    } else {
                        // Scoped to tag name: wrap in tag selector
                        processedCssText = `${tagName} { ${processedCssText} }`;
                    }
                }
                const stylesheet = await createStylesheet(processedCssText);
                this.assetHost.adoptedStyleSheets?.push(stylesheet);

                // Track the original CSS source, not the processed version
                addedStylesheets.add(cssText);
            }
        } finally {
            // Release the lock
            globalThis._cssLocks.delete(this._assetHostKey);
            releaseLock();
        }
    }

    async css(styles) {
        if (typeof styles === 'string') {
            styles = [styles]; // if styles is a string make it an array
        }
        if (Array.isArray(styles)) {
            // add COMPONENT_PATH to each path if it doesn't look like raw CSS
            styles = styles.map(str => {
                if (typeof str !== 'string') return console.warn('Base.css: style entry is not a string:', str);
                // Heuristic: whitespace in a non-URL likely means CSS text
                if (looksLikeCssText(str)) return str; // raw css text, don't resolve as URL
                str = new URL(str, COMPONENT_PATH).href;
                return str;
            });
            return await getCss(...styles); // promise that resolves to an array of stylesheets
        } else console.warn('Base.css: styles is not a string or array:', styles);
    }
}


// Utils
// import { processPlaceholders, getCss, createStylesheet } from './utils.js';

globalThis.htmlPromiseCache ??= new Map();
globalThis.cssPromiseCache ??= new Map();


/**
 * Fetches HTML content from a given path with caching support.
 * 
 * @async
 * @function getHtml
 * @param {string} path - The relative path to the HTML file
 * @param {string} [basePath] - The base path to resolve the file from
 * @returns {Promise<string|undefined>} The HTML content as a string, or undefined if fetch fails
 * @throws {Error} Throws an error if the fetch request fails
 * 
 * @description
 * This function implements a caching mechanism using globalThis.htmlPromiseCache to avoid
 * duplicate requests for the same HTML file. The path is normalized using URL constructor
 * before fetching. If a request for the same path is already in progress, it returns the
 * existing promise rather than making a new request.
 * 
 * @example
 * const html = await getHtml('template.html'); // Fetch from the COMPONENT_PATH
 * 
 * @example
 * const html = await getHtml('components/header.html', 'https://example.com/'); // Fetch from path
 */
export async function getHtml(path, basePath = COMPONENT_PATH) {
    path = `${basePath}${path}`;
    path = new URL(path, basePath).href; // normalize path
    try {
        // Check if we already have a promise for this file
        if (!globalThis.htmlPromiseCache.has(path)) {
            // Create and cache the fetch promise
            const fetchPromise = fetch(path).then(response => {
                if (!response.ok) throw new Error(`Failed to fetch html: ${path}`);
                return response.text();
            });
            globalThis.htmlPromiseCache.set(path, fetchPromise);
        }
        // Await the cached promise
        return await globalThis.htmlPromiseCache.get(path);
    } catch (error) { console.error('Failed to load html:', error); }
}

/**
 * Fetch and cache CSS stylesheets.
 * @param {...string} stylesheetPaths - The paths to the stylesheets to fetch.
 * @returns {Promise<string[]>} A promise that resolves to an array of CSS stylesheets.
 */
export async function getCss(...stylesheetPaths) {
    const stylesheets = [];
    for (let path of stylesheetPaths) {

        // If it's not a string just skip/fallback
        if (typeof path !== 'string') continue;

        // Detect raw CSS text: contains newline, braces, semicolon, or whitespace but not a URL-like scheme
        if (looksLikeCssText(path)) {
            const cssText = path.trim();
            if (!stylesheets.includes(cssText)) stylesheets.push(cssText);
            continue;
        }

        // Check if we already have a promise for this stylesheet
        if (!globalThis.cssPromiseCache.has(path)) {
            // Create and cache the complete stylesheet creation promise
            const stylesheetPromise = fetch(path)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to fetch stylesheet: ${path}`);
                    return response.text();
                })
                .catch(error => {
                    console.error(`Error loading stylesheet ${path}:`, error);
                    // return new CSSStyleSheet(); // return empty stylesheet as fallback
                    return '';
                });
            globalThis.cssPromiseCache.set(path, stylesheetPromise);
        }
        // Await the cached promise
        const stylesheet = await globalThis.cssPromiseCache.get(path);
        stylesheets.push(stylesheet);
    }
    return stylesheets;
}