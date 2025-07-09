/**
 * Utility to trim and clean (empty items from) an array of strings
 * @param {Array<string>} arr - The array of strings to clean
 * @returns {Array<string>} A new array with trimmed and cleaned strings
 * @example
 * cleanItems(['  hello  ', '  world  ', '', '  ']); // Returns ['hello', 'world']
*/
export function cleanItems(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
        .map(item => item.trim())
        .filter(item => item); // Filter out empty strings
}

/**
 * Checks if a given path is a remote URL 
 * @param {string} path - The path to check
 * @returns {boolean} True if the path is a remote URL, false otherwise
*/
export function isRemoteUrl(path) {
    return path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//');
}

/**
 * Observes an element for intersection with the viewport
 * @param {HTMLElement} element - The element to observe
 * @param {Function} callback - The function to call when the element is intersecting
 * @param {boolean} [once=true] - If true, the observer will unobserve the element after the first intersection
 * @example
 * observeIntersection(document.querySelector('#myElement'), () => {
 *     console.log('Element is in view!');
 * });
*/
export function observeIntersection(element, callback, once=true) {
    const observer = new IntersectionObserver(([{isIntersecting}]) => {
        if (isIntersecting) {
            callback();
            if (once) observer.unobserve(element);
        }
    });
    observer.observe(element);
}

/**
 * Creates an HTML element from a string
 * @param {string} htmlString - The HTML string to convert into an element
 * @returns {HTMLElement} The created HTML element
 */
export function createElement(htmlString) {
    const template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
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
 * Generates a random ID based on the provided parameter
 * @param {number[]|number} param - An array of lengths for letters and digits
 *                                  or a single number for an alphanumeric string
 * @returns {string} A random ID string
 * @example
 * generateRandomId([2, 3, 2]); // Returns something like "aa123bb"
 * generateRandomId(6); // Returns something like "a1b2c3"
 */
export function generateRandomId(param = [2,3,2]) {
	if (Array.isArray(param)) {
		return param.map((length, index) => {
			if (index % 2 === 0) {
				// Generate random letters
				return Array.from({ length }, () =>
					String.fromCharCode(97 + Math.floor(Math.random() * 26))
				).join("");
			} else {
				// Generate random digits
				return Array.from({ length }, () =>
					Math.floor(Math.random() * 10)
				).join("");
			}
		}).join("");
	} 
	else if (typeof param === 'number') {
		// Generate random alphanumeric string
		const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
		return Array.from({ length: param }, () =>
				chars.charAt(Math.floor(Math.random() * chars.length))
		).join("");
	} 
	else { throw new Error('Invalid parameter type'); }
}