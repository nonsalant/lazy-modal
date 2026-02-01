const COMPONENT_PATH = import.meta.resolve('./');
const { Base, getHtml } = await import(`./lib/base/base.js?path=${encodeURIComponent(COMPONENT_PATH)}`);
import { defineElement, processPlaceholders, executeScripts } from './lib/base/base-utils.js';
import { csvToArray, isRemoteUrl, observeIntersection, unobserveIntersection } from './lib/lazy-modal-utils.js';

export default class LazyModal extends Base {
    static enableShadowRoot = true;
    static styles = [
        // `h1 { text-decoration: underline; }`,
        // 'lazy-modal.css',
        'lazy-modal.scoped.css',
        'elements/aria-busy.css',
        'elements/close-button.css',
    ];
    static globalStyles = [
        'elements/aria-busy.css',
    ]

    #host; #triggers; #assetHost; #styles; #scripts;
    #abortController; #abortSignal; #loadOn; #triggerObserver;
    #modalContent; #lazyRenderTemplate; #loadingAssetsPromise;

    constructor() {
        super();

        const closeButtonAttr = this.getAttribute('close-button');
        this.closeButton = closeButtonAttr === 'false'
            ? false
            : (closeButtonAttr !== 'true' && closeButtonAttr) || 'elements/close-button.html';

        this.#host = this.getRootNode(); // 'document' or a shadow root

        this.#triggers = this.#host.querySelectorAll(this.getAttribute('triggers'));
        this.#abortController = new AbortController();
        this.#abortSignal = { signal: this.#abortController.signal };

        const supportedLoadOnValues = ['click', 'hover', 'visible', 'load'];
        this.#loadOn = supportedLoadOnValues.includes(this.getAttribute('load-on'))
            ? this.getAttribute('load-on')
            : 'hover';

        this.#assetHost = this.hasAttribute('in-head') ? document.head : this.root;
        this.#styles = csvToArray(this.getAttribute('inner-styles'));
        this.#scripts = csvToArray(this.getAttribute('inner-scripts'));
        this.#modalContent = this.getAttribute('inner-content') || '';
        this.#lazyRenderTemplate = this.querySelector('& > template') || null;
        this.popover ||= '';

        if (this.constructor.enableShadowRoot && !this.shadowRoot.innerHTML) {
            // this.root.lastElementChild.insertAdjacentHTML('afterend', '<slot></slot>');
            // this.shadowRoot.innerHTML = '<slot></slot>';
            // const noSlots = this.querySelector('[slot]') === null;
            // if (noSlots)
                this.moveLightToShadow();
        }
    }

    connected() {
        if (!this.#lazyRenderTemplate && !this.#modalContent) {
            // 📡 Dispatch a custom event
            this.dispatchContentLoadedEvent();
        }
        this.#setupAssetLoading(); // Assets for what's inside the modal
        this.#setupTriggerBehavior();
    }

    disconnected() {
        if (!this.#triggers.length) return;
        this.#abortController.abort(); // Removes all listeners at once
        if (this.#loadOn === 'visible') this.#triggers.forEach(trigger => {
            unobserveIntersection(this.#triggerObserver, trigger);
        });
    }

    #setupTriggerBehavior() {
        if (!this.#triggers.length) return console.warn('LazyModal: No trigger element found');

        if (this.#loadOn === 'load') this.loadAssets(); // Load assets immediately if 'load' is set

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
            // document.querySelector('#location-wrapper')?.hidePopover();
            // if (trigger.classList.contains('map-trigger')) {
            // document.querySelector('#location-wrapper')?.hidePopover();
            // }
        }
    }

    #setupAssetLoading() {
        this.loadAssets = async () => {
            // only run once
            if (this.#loadingAssetsPromise) return this.#loadingAssetsPromise;

            this.#lazyRender(); // Lazy render template if provided
            this.#loadingAssetsPromise = Promise.all([
                this.addContent(this.#modalContent), // Optionally inject external content
                ...this.#scripts.map(path => this.addScript(path)),
                ...this.#styles.map(path => this.addStyle(path)),
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
            this.root.appendChild(content);
            if (!this.#modalContent) {
                // 📡 Dispatch a custom event
                this.dispatchContentLoadedEvent();
            }
        }
    }

    async renderBefore() {
        const closeButton = this.closeButton ? await getHtml(this.closeButton) : '';
        return `${closeButton}`;
    }

    afterRender() {
        // Called after the modal is rendered
        this.root.querySelector('.close-button')?.addEventListener('click', () => this.hidePopover());
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
        const content = await getHtml(htmlPath);
        const processedContent = processPlaceholders(content, this);
        // this.root.lastElementChild.after(createFragment(processedContent)); // registers custom elements too early
        if (this.root.lastElementChild) 
            this.root.lastElementChild.insertAdjacentHTML('afterend', processedContent); // this doesn't execute scripts
        else this.root.innerHTML += processedContent;
        executeScripts(this.root);
        // 📡 Dispatch a custom event
        this.dispatchContentLoadedEvent();
    }

    dispatchContentLoadedEvent() {
        this.dispatchEvent(new Event('lazy-modal-content-loaded', { bubbles: true, composed: true }));
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
    async #addResource(file, { tagName, attributes, urlAttribute = 'src' }) {
        const path = COMPONENT_PATH;
        const fullPath = isRemoteUrl(file) ? file : `${path}${file}`;
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
            element[urlAttribute] = isRemoteUrl(file)
                ? file
                : `${path}${file}`;
            element.onload = () => resolve();
            element.onerror = (error) => {
                console.warn(`lazy-modal.js failed to load resource: ${file}`, error);
                resolve(); // Still resolve to not block other resources
            };
            if (this.#lazyRenderTemplate) {
                this.#assetHost.appendChild(element);
                // this.appendChild(element);
            }
            else {
                // this.root.appendChild(element);
                if (this.#modalContent) {
                    this.#assetHost.appendChild(element);
                } else {
                    // this.appendChild(element);
                    this.root.appendChild(element);
                }
            }
        });
    }


    // Statically define (or rename) the element unless ?define=false is set in the URL
    static {
        const tag = new URL(import.meta.url).searchParams.get('define');
        defineElement(tag, this);
    }
}

// customElements.define('lazy-modal', LazyModal);