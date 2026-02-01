/**
 * Defines a custom element with the specified tag and class.
 * @param {string} tag - The tag name for the custom element.
 * @param {class} componentClass - The class definition for the custom element.
 * @see https://til.jakelazaroff.com/html/define-a-custom-element/
 */
export function defineElement(tag, component) {
    if (tag === 'false') return;
    if (tag === null) tag = camelToKebab(component.name);
    const name = customElements.getName(component); if (name) return console.warn(`${component.name} already defined as <${name}>!`);
    const el = customElements.get(tag); if (Boolean(el) && el !== component) return console.warn(`<${tag}> already defined as ${el.name}!`);
    customElements.define(tag, component);
}

/**
 * Generates a random ID based on the provided parameter
 * @param {number[]|number} param - An array of lengths for letters and digits
 *                                  or a single number for an alphanumeric string
 * @returns {string} A random ID string
 *
 * @example
 * generateRandomId([2, 3, 2]); // Returns something like 'aa123bb'
 * generateRandomId(6); // Returns something like 'a1b2c3'
 */
export function generateRandomId(param = [2, 3, 2]) {
    if (Array.isArray(param)) {
        return param.map((length, index) => {
            if (index % 2 === 0) {
                // Generate random letters
                return Array.from({ length }, () =>
                    String.fromCharCode(97 + Math.floor(Math.random() * 26))
                ).join('');
            } else {
                // Generate random digits
                return Array.from({ length }, () =>
                    Math.floor(Math.random() * 10)
                ).join('');
            }
        }).join('');
    }
    else if (typeof param === 'number') {
        // Generate random alphanumeric string
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length: param }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('');
    }
    else { throw new Error('Invalid parameter type'); }
}

/**
 * Creates a CSSStyleSheet from CSS text
 * @param {string} cssText - The CSS text to create a stylesheet from
 * @returns {Promise<CSSStyleSheet>} A promise that resolves to a CSSStyleSheet
 */
export async function createStylesheet(cssText) {
    const stylesheet = new CSSStyleSheet();
    await stylesheet.replace(cssText);
    return stylesheet;
}

/**
 * Converts a CamelCase string into a kebab-case string
 * @param {string} str - The CamelCase string to convert
 * @returns {string} The converted kebab-case string
 * @example
 * camelToKebab('myCamelCaseString'); // 'my-camel-case-string'
 */
export function camelToKebab(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Detects whether a string looks like raw CSS text or a URL.
 * @param {string} str - The string to check.
 * @returns {boolean} True if the string appears to be raw CSS text, false if it looks like a URL.
 * 
 * true if the string contains a newline, {, } or ; (common characters in CSS rules).
 * true if the string contains whitespace but is not an http(s) URL and not a data/blob/file URL (heuristic: whitespace in a non-URL likely means CSS text).
 *
 * 'body { color: red; }' → true (raw CSS)
 * '.my-class { display: flex } ' → true
 * 'styles.css' → false
 * 'https://example.com/styles.css' → false
 * 'data:text/css,...' → false
 */
export function looksLikeCssText(str) {
    return /[\n\{;\}]/.test(str) || (/\s/.test(str) && !/^\s*https?:\/\//i.test(str) && !/^\s*(data|blob|file):/i.test(str));
}

/**
 * Replace ${prop} placeholders in an HTML template string with resolved values and mark script tags.
 * @param {string} html - HTML template containing ${prop} placeholders.
 * @param {Object|Element} context - The context used to resolve placeholders.
 * @param {boolean} [markScripts=true] - Whether to mark script tags with a data attribute.
 * @returns {string} Processed HTML string with placeholders replaced.
 * @throws {TypeError} If `html` is not a string or `context` is not an object or Element.
 */
export function processPlaceholders(html, context, markScripts = true) {
    if (html == null) return '';

    if (typeof html !== 'string') {
        throw new TypeError('processPlaceholders(html): expected a string');
    }
    if (context == null || (!['object', 'function'].includes(typeof context))) {
        throw new TypeError('processPlaceholders(context): expected an object or Element');
    }

    const toStr = v => (v == null ? '' : String(v));

    // Extract script tags and replace with placeholders
    const scriptTagRegex = /<script(\s[^>]*)?>[\s\S]*?<\/script>/gi;
    const scripts = [];
    let workingHtml = html.replace(scriptTagRegex, (match) => {
        scripts.push(match);
        return `<!--SCRIPT_PLACEHOLDER_${scripts.length - 1}-->`;
    });

    // Process placeholders only in non-script content
    const propRegex = /\$\{([^}]+)\}/g; // matches ${prop} placeholders
    workingHtml = workingHtml.replace(propRegex, (_, raw) => {
        const prop = String(raw).trim();
        // Using != null preserves falsy values like 0, false and '' while excluding null/undefined.
        // 1) dataset (attributes from data-*, automatic kebab-case conversion)
        if (context.dataset && context.dataset[prop] != null) {
            return context.dataset[prop];
        }

        // 2) attribute (Element-like API), convert camel to kebab for attribute names
        if (typeof context.getAttribute === 'function') {
            const attr = context.getAttribute(camelToKebab(prop));
            if (attr != null) return attr;
        }

        // 3) direct property lookup (supports plain objects and instances)
        if (context[prop] != null) {
            return toStr(context[prop]);
        }

        // 4) fallback to static prop
        if (context.constructor && context.constructor[prop] != null) {
            return toStr(context.constructor[prop]);
        }

        // not found -> empty string // ! breaks string literals (eg: in js in html)
        console.warn(`Property '${prop}' not found in context: ${context}`);
        // return '';
        return _;
    });

    // Restore script tags
    scripts.forEach((script, index) => {
        if (markScripts) script = script.replace('<script', '<script data-not-executed');
        workingHtml = workingHtml.replace(`<!--SCRIPT_PLACEHOLDER_${index}-->`, script);
    });

    return workingHtml;
}

/**
 * Marks all script tags in the given markup with a data attribute
 * @param {string} markup - The HTML markup containing script tags
 * @returns {string} The modified HTML markup with script tags marked
 * @example
 * const markedMarkup = markScripts('<script></script>'); // => '<script data-not-executed></script>'
 */
export function markScripts(markup) {
    // replace all instances
    return markup.replace(/<script/g, '<script data-not-executed');
}

/**
 * Executes all script elements within a given context by creating and replacing them.
 * This is necessary because scripts inserted via innerHTML or similar methods don't execute automatically.
 * 
 * @param {Element|DocumentFragment|ShadowRoot} context - The DOM context containing script elements to execute.
 * @param {boolean} [markedScriptsOnly=true] - If true, only scripts with the 'data-not-executed' attribute will be executed.
 * 
 * @example
 * const container = document.getElementById('dynamic-content');
 * container.innerHTML = '<script>console.log("Hello");</script>';
 * executeScripts(container); // The script will now execute
 */
export function executeScripts(context, markedScriptsOnly = true) {
    const selector = markedScriptsOnly ? 'script[data-not-executed]' : 'script';
    context.querySelectorAll(selector).forEach(oldScript => {
        oldScript.removeAttribute('data-not-executed');

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

// not used
/**
 * Create a DocumentFragment from an HTML string.
 * @param {string} html - HTML template string; may contain ${prop} placeholders.
 * @returns {DocumentFragment} DocumentFragment containing parsed nodes from the processed HTML.
 * @throws {TypeError} If `html` is not a string.
 */
function createFragment(html) {
    if (typeof html !== 'string') {
        throw new TypeError('createFragment(html): expected a string');
    }
    // note: this registers custom elements before they they are added to the DOM
    return document.createRange().createContextualFragment(html);
}

/**
 * Hides elements if keyboard input is not supported.
 * @param {Element[]} elements - Array of elements to potentially hide.
 * 
 * @example
 * const kbdElements = document.querySelectorAll('.js-hidden-if-no-kbd');
 * kbdOnly(kbdElements);
 */
export function kbdOnly(elements) {
    elements.forEach(el => {
        el.hidden = !('keyboard' in navigator);
    });
}



/**
 * Appends HTML content to an element, inserting after the last child if a child exists.
 * @param {Element} el - The element to append HTML to.
 * @param {string} html - The HTML string to append.
 * 
 * @example
 * appendHtml(container, '<div>New content</div>');
 */
export function appendHtml(el, html) {
    if (el.firstElementChild) el.lastElementChild.insertAdjacentHTML('afterend', html);
    else el.innerHTML += html;
}

/**
 * Prepends HTML content to an element, inserting before the first child if a child exists.
 * @param {Element} el - The element to prepend HTML to.
 * @param {string} html - The HTML string to prepend.
 * 
 * @example
 * prependHtml(container, '<div>New content</div>');
 */
export function prependHtml(el, html) {
    if (el.firstElementChild) el.firstElementChild.insertAdjacentHTML('beforebegin', html);
    else el.innerHTML = html + el.innerHTML;
}