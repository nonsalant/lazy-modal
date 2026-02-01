import { createStylesheet, looksLikeCssText, processPlaceholders, executeScripts, camelToKebab } from './base-utils.js';

// Get the component path from the URL query parameter
const COMPONENT_PATH = new URL(import.meta.url).searchParams.get('path');

// Track added stylesheets to prevent duplicates across all component instances
globalThis._addedStylesheets ??= new Map(); // Map of assetHost -> Set of CSS texts
globalThis._cssLocks ??= new Map(); // Map of assetHost -> Promise (lock)

export class Base extends HTMLElement {
    static enableShadowRoot = false;
    static styles = [];
    static baseStyle = '.dom-root { display: contents; }';
    static globalStyles = [];
    static globalBaseStyle = '';

    // https://hawkticehurst.com/2024/05/bring-your-own-base-class/#:~:text=class%20BaseElement,-extends%20HTMLElement%20%7Bconstructor
    constructor() {
        super();

        // Attach shadow root if enabled and not already present (via declarative shadow DOM)
        const needsShadow = this.constructor.enableShadowRoot && !this.shadowRoot;
        if (needsShadow) {
            this.attachShadow({ mode: 'open' });
            // this.shadowRoot.innerHTML = `<div class="dom-root"></div>`;
        }

        // Current shadow root or the first parent shadow root or 'document':
        this.assetHost = this.shadowRoot ?? this.getRootNode();
        // console.log(this.constructor.name, this.assetHost);

        // Setup root to the shadow root child or 'this'
        if (this.shadowRoot) {
            this.root = this.shadowRoot;
            // // 🚧 if no slots are initially present, move content into domRoot
            // const noSlots = this.querySelector('[slot]') === null;
            // if (noSlots) this.moveLightToShadow();
        } else this.root = this;

        // Setup assetHostKey for tracking added stylesheets
        const assetHostKey = this.assetHost === document ? 'document' : this.assetHost;
        // Initialize Set for this assetHost if not present, otherwise use existing _addedStylesheets.get(assetHostKey)
        if (!globalThis._addedStylesheets.has(assetHostKey)) {
            globalThis._addedStylesheets.set(assetHostKey, new Set());
        }
        this._assetHostKey = assetHostKey;
    }

    moveLightToShadow(processContent = false) {
        if (processContent) {
            // note: scripts won't execute, listeners are lost
            const processedHtml = processPlaceholders(this.innerHTML, this);
            if (this.root.lastElementChild) {
                this.root.lastElementChild.insertAdjacentHTML('afterend', processedHtml);
            } else {
                this.root.innerHTML += processedHtml;
            }
            executeScripts(this.root);
            this.innerHTML = ''; // clear light DOM content
            return;
        }
        while (this.firstChild) {
            this.root.appendChild(this.firstChild);
        }
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
        await this.addGlobalCss();

        const markup = await this.render();
        const beforeMarkup = await this.renderBefore();
        const processedBeforeHtml = processPlaceholders(beforeMarkup, this);
        const processedHtml = processPlaceholders(markup, this); // or: processPlaceholders(markup, { myValue: 'yoo' });

        // this.root.firstElementChild.before(createFragment(processedBeforeHtml));
        // this.root.lastElementChild.after(createFragment(processedHtml)); // registers custom elements too early

        if (this.root.firstElementChild) this.root.firstElementChild.insertAdjacentHTML('beforebegin', processedBeforeHtml);
        else this.root.innerHTML += processedBeforeHtml;
        if (this.root.lastElementChild) this.root.lastElementChild.insertAdjacentHTML('afterend', processedHtml);
        else this.root.innerHTML += processedHtml;

        executeScripts(this.root);

        await this.afterRender();
    }

    disconnected() { }
    connected() { }
    async afterRender() { }
    async render() { return ''; }
    async renderBefore() { return ''; }

    async _addStylesheetsWithLock(assetHostKey, target, cssTexts, scoper = null) {

        // for (const cssText of cssTexts) {
        //     const processedCssText = processPlaceholders(cssText, this);
        //     const stylesheet = await createStylesheet(processedCssText);
        //     this.assetHost.adoptedStyleSheets?.push(stylesheet);
        // }
        
        // Wait for any pending CSS additions for this assetHost
        while (globalThis._cssLocks.get(assetHostKey)) {
            await globalThis._cssLocks.get(assetHostKey);
        }

        // Create a lock promise
        let releaseLock;
        const lockPromise = new Promise(resolve => { releaseLock = resolve; });
        globalThis._cssLocks.set(assetHostKey, lockPromise);

        try {
            // Ensure the Set exists for this assetHostKey
            if (!globalThis._addedStylesheets.has(assetHostKey)) {
                globalThis._addedStylesheets.set(assetHostKey, new Set());
            }
            const stylesheetSet = globalThis._addedStylesheets.get(assetHostKey);
            
            for (const cssText of cssTexts) {
                if (stylesheetSet.has(cssText)) continue;

                let processedCssText = processPlaceholders(cssText, this);
                if (scoper) {
                    processedCssText = scoper(processedCssText);
                }

                const stylesheet = await createStylesheet(processedCssText);
                target.adoptedStyleSheets?.push(stylesheet);
                stylesheetSet.add(cssText);
            }
        } finally {
            globalThis._cssLocks.delete(assetHostKey);
            releaseLock();
        }
    }

    async addGlobalCss() {
        const styles = [...this.constructor.globalStyles, this.constructor.globalBaseStyle];
        const cssTexts = await this.css(styles);
        await this._addStylesheetsWithLock('document', document, cssTexts);
    }

    async addCss() {
        const styles = [...this.constructor.styles, this.constructor.baseStyle];
        const cssTexts = await this.css(styles);
        
        let index = 0;
        const scoper = (processedCssText) => {
            const filename = styles[index++];
            
            // Scoped stylesheet handling
            if (filename?.endsWith('.scoped.css')) {
                const tagName = camelToKebab(this.constructor.name);
                return this.shadowRoot 
                    ? `:host { ${processedCssText} }`
                    : `${tagName} { ${processedCssText} }`;
            }
            return processedCssText;
        };

        await this._addStylesheetsWithLock(this._assetHostKey, this.assetHost, cssTexts, scoper);
    }

    async css(styles) {
        if (typeof styles === 'string') {
            styles = [styles]; // if styles is a string make it an array
        }
        if (Array.isArray(styles)) {
            // add COMPONENT_PATH to each path if it doesn't look like raw CSS
            styles = styles.map(str => {
                if (str === '') return; // skip empty strings
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