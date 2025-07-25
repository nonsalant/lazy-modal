import {
    csvToArray,
    isRemoteUrl,
    observeIntersection,
    unobserveIntersection,
    createStylesheet,
} from './utils.js';

class LazyModal extends HTMLElement {
    // fetching from path is skipped if #closeButton is set
    static #closeButtonPath = 'close-button.html';
    // fetching from path is skipped if the #modalCss array is set    
    static #modalCssPaths = ['lazy-modal.css', 'aria-busy.css'];

    #host; #triggers; #assetHost; #styles; #scripts;
    #abortController; #abortSignal; #loadOn; #triggerObserver;
    #modalContent; #lazyRenderTemplate; #loadingAssetsPromise;

    constructor() {
        super();
        this.#host = this.getRootNode(); // 'document' or a shadow root

        this.#triggers = this.#host.querySelectorAll(this.getAttribute('triggers'));
        this.#abortController = new AbortController();
        this.#abortSignal = { signal: this.#abortController.signal };

        const supportedLoadOnValues = ['click', 'hover', 'visible', 'load'];
        this.#loadOn = supportedLoadOnValues.includes(this.getAttribute('load-on')) 
            ? this.getAttribute('load-on') 
            : 'hover';
        
        this.#assetHost = this.hasAttribute('in-head') ? document.head : this;
        this.#styles = csvToArray(this.getAttribute('inner-styles'));
        this.#scripts = csvToArray(this.getAttribute('inner-scripts'));
        this.#modalContent = this.getAttribute('inner-content') || '';
        this.#lazyRenderTemplate = this.querySelector('& > template') || null;
        this.popover ||= '';
    }
    
    connectedCallback() {
        this.#setupModalUi(); // Modal HTML and CSS
        this.#setupAssetLoading(); // Assets for what's inside the modal
        this.#setupTriggerBehavior();
    }
    
    disconnectedCallback() {
        if (!this.#triggers.length) return;
        this.#abortController.abort(); // Removes all listeners at once
        if (this.#loadOn === 'visible') this.#triggers.forEach(trigger => {
            unobserveIntersection(this.#triggerObserver, trigger);
        });
    }
    
    #setupTriggerBehavior() {
        if (this.#loadOn === 'load') this.loadAssets(); // Load assets immediately if 'load' is set

        if (!this.#triggers.length) return console.warn('LazyModal: No trigger element found');

        this.#triggers.forEach(trigger => {
            trigger.addEventListener('click', this.handleClick.bind(this), this.#abortSignal);

            if (this.#loadOn === 'hover') ['mouseenter', 'focus'].forEach((e) => {
                trigger.addEventListener(e, () => this.loadAssets(), this.#abortSignal);
            });

            if (this.#loadOn === 'visible') {
                this.#triggerObserver = observeIntersection(trigger, () => this.loadAssets());
            }
        });
    }

    async handleClick(e) {
        e.preventDefault();
        const trigger = e.currentTarget;
        if (trigger.ariaBusy) return;
        trigger.ariaBusy = true;
        try {
            await this.loadAssets();
            this?.togglePopover({ source: trigger });
        }
        catch (error) { console.error('Failed to handle click:', error); }
        finally {
            trigger.ariaBusy = null;
        }
    }

    #setupAssetLoading() {
        this.loadAssets = async () => {
            // only run once
            if (this.#loadingAssetsPromise) return this.#loadingAssetsPromise;

            this.#lazyRender(); // Lazy render template if provided
            this.#loadingAssetsPromise = Promise.all([
                this.addContent(this.#modalContent), // Optionally inject external content
                ...this.#styles.map(path => this.addStyle(path)),
                ...this.#scripts.map(path => this.addScript(path)),
            ]);
            // console.log('LazyModal: Loading assets');
            return this.#loadingAssetsPromise;
        };

        // Load assets when the modal is visible
        // (fallback if no trigger was hovered/focused/clicked)
        observeIntersection(this, () => this.loadAssets());
    }

    /**
     * If the inline content is wrapped in a template, clone it and append to the modal
     * This allows for lazy rendering of the modal content
     * @private
     */
    #lazyRender() {
        if (this.#lazyRenderTemplate) {
            // If a template is provided, clone its content and append it
            const content = this.#lazyRenderTemplate.content.cloneNode(true);
            this.appendChild(content);
        }
    }

    /** 
     * Adds HTML content to the component
     * @param {string} htmlPath - Path to the HTML file to inject
     * @returns {Promise<void>} Resolves when the content is added
     * @example
     * await lazyModal.addContent('path/to/content.html');
    */
    async addContent(htmlPath) {
        if (!htmlPath) return; // No content to add
        const content = await LazyModal.#html(htmlPath);
        this.insertAdjacentHTML('beforeend', content);
        this.#executeScripts(); // Execute any scripts in the injected content
    }

    /**
     * Execute any scripts found in the component's innerHTML
     * This is needed because scripts injected via innerHTML don't execute automatically
     * @private
     */
    #executeScripts(context = this) {
        context.querySelectorAll('script').forEach(oldScript => {
            const newScript = document.createElement('script');

            // Copy all attributes
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });

            // Copy the script content
            newScript.textContent = oldScript.textContent;

            // Replace the old script with the new one
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }

    /**
     * Adds a stylesheet to the component
     * @param {string} cssPath - Path to the CSS file
     * @returns {Promise<void>} Resolves when the stylesheet is loaded
     */
    addStyle(cssPath) {
        return this.#addResource(cssPath, { tagName: 'link', attributes: { rel: 'stylesheet' }, urlAttribute: 'href' });
    }

    /**
     * Adds a script to the component
     * @param {string} jsPath - Path to the JavaScript file
     * @returns {Promise<void>} Resolves when the script is loaded
     */
    addScript(jsPath) {
        return this.#addResource(jsPath, { tagName: 'script', attributes: { type: 'module' }, urlAttribute: 'src' });
    }

    static #globalResources = new Set(); // Track resources added to document.head

    /**
     * Creates and loads a resource (stylesheet or script)
     * @param {string} path - Path to the resource
     * @param {Object} options - Configuration options
     * @param {string} options.tagName - HTML tag name for the element ('link' or 'script')
     * @param {Object} options.attributes - Key-value pairs of attributes to set on the element
     * @param {string} [options.urlAttribute='src'] - Attribute name for the resource URL ('src' or 'href')
     * @returns {Promise<void>} Resolves when the resource is loaded
     * @private
     */
    async #addResource(path, { tagName, attributes, urlAttribute = 'src' }) {
        const fullPath = isRemoteUrl(path) ? path : `${LazyModal.#basePath}/${path}`;
        // If adding to document.head, check if already exists
        if (this.#assetHost === document.head) {
            const resourceKey = `${tagName}:${fullPath}`;
            if (LazyModal.#globalResources.has(resourceKey)) {
                return Promise.resolve(); // Already loaded
            }
            LazyModal.#globalResources.add(resourceKey);
        }

        return new Promise((resolve) => {
            const element = document.createElement(tagName);
            Object.assign(element, attributes);
            // Set the href or src attribute
            element[urlAttribute] = isRemoteUrl(path)
                ? path
                : `${LazyModal.#basePath}/${path}`;
            element.onload = () => resolve();
            element.onerror = (error) => {
                console.warn(`lazy-modal.js failed to load resource: ${path}`, error);
                resolve(); // Still resolve to not block other resources
            };
            this.#assetHost.appendChild(element);
        });
    }


    // Static block to set the base path
    static #basePath;
    static {
        const url = new URL(import.meta.url);
        const moduleUrl = url.pathname;
        this.#basePath = url.origin + moduleUrl.substring(0, moduleUrl.lastIndexOf('/'));
    }


    /* Modal HTML and CSS from external files */

    async #setupModalUi() {
        const stylesheets = await LazyModal.#css(...LazyModal.#modalCssPaths);
        this.#host.adoptedStyleSheets.push(...stylesheets); // CSS for the modal

        if (this.hasAttribute('close-button')) { // Close button is optional
            const closeButtonHtml = await LazyModal.#html(LazyModal.#closeButtonPath);
            this.insertAdjacentHTML('afterbegin', closeButtonHtml);
        }
    }

    // Load and statically cache HTML
    static async #html(path) {
        // skip fetching if the HTML is set in LazyModal.#closeButton
        if (LazyModal.#closeButton) return LazyModal.#closeButton;

        path = `${LazyModal.#basePath}/${path}`;
        try {
            // Check if we already have a promise for this file
            if (!LazyModal.#htmlPromiseCache.has(path)) {
                // Create and cache the fetch promise
                const fetchPromise = fetch(path).then(response => {
                    if (!response.ok) throw new Error(`Failed to fetch html: ${path}`);
                    return response.text()
                });
                LazyModal.#htmlPromiseCache.set(path, fetchPromise);
            }
            // Await the cached promise
            const html = await LazyModal.#htmlPromiseCache.get(path);
            return html ?? '';
        } catch (error) { console.error('Failed to load html:', error); }
    }
    static #htmlPromiseCache = new Map();

    // Load modal CSS files and cache the stylesheets statically
    static async #css(...stylesheetPaths) {
        // skip fetching if CSS is set in the LazyModal.#modalCss array
        if (LazyModal.#modalCss[0]) {
            const promises = LazyModal.#modalCss.map(cssText => createStylesheet(cssText));
            return await Promise.all(promises); // Return an array of stylesheets
        }

        const stylesheets = [];
        for (let path of stylesheetPaths) {
            path = `${LazyModal.#basePath}/${path}`;

            // Check if we already have a promise for this stylesheet
            if (!LazyModal.#cssPromiseCache.has(path)) {
                // Create and cache the complete stylesheet creation promise
                const stylesheetPromise = fetch(path)
                    .then(response => {
                        if (!response.ok) throw new Error(`Failed to fetch stylesheet: ${path}`);
                        return response.text();
                    })
                    .then(async (cssText) => { return await createStylesheet(cssText); })
                    .catch(error => {
                        console.error(`Error loading stylesheet ${path}:`, error);
                        return new CSSStyleSheet(); // Return empty stylesheet as fallback
                    });

                LazyModal.#cssPromiseCache.set(path, stylesheetPromise);
            }

            // Await the cached promise
            const stylesheet = await LazyModal.#cssPromiseCache.get(path);
            stylesheets.push(stylesheet);
        }
        return stylesheets;
    }
    static #cssPromiseCache = new Map();

    static #closeButton = ``; // won't be used if empty
    static #modalCss = [ // if the first item is empty, the array won't be used
        ``,
        `:host { background: red; }`, // Example CSS, replace with actual styles
    ];

}

customElements.define('lazy-modal', LazyModal);