/**
 * Utility to convert a CSV string into an array of trimmed, non-empty strings
 * @param {string} csvString - The CSV string to convert
 * @param {string} [delimiter=','] - The delimiter to split on (defaults to comma)
 * @returns {Array<string>} A new array with trimmed, non-empty strings from the CSV
 * @example
 * csvToArray('apple, banana, cherry'); // Returns ['apple', 'banana', 'cherry']
 * csvToArray('apple; banana; cherry', ';'); // Returns ['apple', 'banana', 'cherry']
 * csvToArray('  hello  ,  world  , , foo '); // Returns ['hello', 'world', 'foo']
 */
export function csvToArray(csvString, delimiter = ',') {
    if (typeof csvString !== 'string') return [];
    if (csvString.trim() === '') return [];
    
    return csvString
        .split(delimiter)
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
 * @return {IntersectionObserver} The IntersectionObserver instance
 * @example
 * observeIntersection(document.querySelector('#myElement'), () => {
 *     console.log('Element is in view!');
 * });
*/
export function observeIntersection(element, callback, once=true) {
    const observer = new IntersectionObserver(([{isIntersecting}]) => {
		if (!isIntersecting) return;
		callback();
		if (once) observer.unobserve(element);
	});
	observer.observe(element);
	return observer;
}

/**
 * Unobserves an element from an IntersectionObserver
 * @param {IntersectionObserver} observer - The IntersectionObserver instance
 * @param {HTMLElement} element - The element to unobserve
 * @example
 * unobserveIntersection(myObserver, document.querySelector('#myElement'));
*/
export function unobserveIntersection(observer, element) {
	if (!observer || !element) return;
	observer.unobserve(element);
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