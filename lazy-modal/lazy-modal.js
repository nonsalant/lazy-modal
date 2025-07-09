import {
    cleanItems,
    isRemoteUrl,
    observeIntersection,
    createStylesheet,
    generateRandomId
} from './utils.js';

class LazyModal extends HTMLElement {
    // fetching from path is skipped if #closeButton is set
    static #closeButtonPath = 'close-button.html';
    // fetching from path is skipped if the #modalCss array is set    
    static #modalCssPaths = ['lazy-modal.css', 'aria-busy.css'];

    #host; #triggers; #assetHost; #styles; #scripts; #modalContent; #loadingAssetsPromise;

    constructor() {
        super();
        this.id ||= `lazy-modal-${generateRandomId([2,3,2])}`; // Ensure a unique ID
        this.resourceClass = `lazy-modal-resource-${this.id}`; // Class for resources
        this.#host = this.getRootNode(); // 'document' or a shadow root
        this.#triggers = this.#host.querySelectorAll(this.getAttribute('triggers'));

        this.#assetHost = this.hasAttribute('in-head') ? document.head : this;
        this.#styles = cleanItems(this.getAttribute('inside-styles')?.split(',')) ?? [];
        this.#scripts = cleanItems(this.getAttribute('inside-scripts')?.split(',')) ?? [];
        this.#modalContent = this.getAttribute('inside-content') || '';
        this.popover = '';
    }
    
    connectedCallback() {
        this.#setupModalUi(); // Modal HTML and CSS
        this.#setupAssetLoading(); // Assets for what's inside the modal
        this.#addTriggerEvents();
    }

    disconnectedCallback() {
        this.#removeTriggerEvents();
        this.#loadingAssetsPromise = null; // Clear the loading promise
        this.#assetHost.querySelectorAll(`.${this.resourceClass}`).forEach(el => el.remove());
    }

    #addTriggerEvents() {
        if (!this.#triggers.length) return console.warn('LazyModal: No trigger element found');

        this.#triggers.forEach(trigger => {
            ['mouseenter', 'focus'].forEach((event) => {
                trigger.addEventListener(event, () => this.loadAssets());
            });

            trigger.addEventListener('click', this.handleClick.bind(this));
            
            // Load assets when a trigger is visible
            // observeIntersection(trigger, () => this.loadAssets());
        });
    }

    #removeTriggerEvents() {
        if (!this.#triggers.length) return;

        this.#triggers.forEach(trigger => {
            ['mouseenter', 'focus'].forEach((event) => {
                trigger.removeEventListener(event, () => this.loadAssets());
            });

            trigger.removeEventListener('click', this.handleClick.bind(this));
        });
    }

    async handleClick(e) {
        e.preventDefault();
        const trigger = e.currentTarget;
        if (trigger.ariaBusy) return;
        trigger.ariaBusy = true;
        try {
            await this.loadAssets();
            this.togglePopover({ source: trigger });
        }
        catch (error) { console.error('Failed to handle click:', error); }
        finally { trigger.ariaBusy = null; }
    }

    #setupAssetLoading() {
        this.loadAssets = async () => {
            if (this.#loadingAssetsPromise) return this.#loadingAssetsPromise;
            this.#loadingAssetsPromise = Promise.all([
                ...this.#styles.map(path => this.addStyle(path)),
                ...this.#scripts.map(path => this.addScript(path)),
                this.addContent(this.#modalContent) // Optionally inject modal content
            ]);
            // console.log('LazyModal: Loading assets');
            // return this.#loadingAssetsPromise;
        };

        // Load assets when the modal is visible
        // (fallback if no trigger was hovered/focused/clicked)
        observeIntersection(this, () => this.loadAssets());
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
        return new Promise((resolve) => {
            const element = document.createElement(tagName);
            attributes.className = this.resourceClass;
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
        // Execute any scripts in the injected content
        this.#executeScripts();
    }

    /**
     * Execute any scripts found in the component's innerHTML
     * This is needed because scripts injected via innerHTML don't execute automatically
     * @private
     */
    #executeScripts() {
        const scripts = this.querySelectorAll('script');
        scripts.forEach(oldScript => {
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