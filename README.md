# lazy-modal web component

Popover starts loading assets when you hover or focus its trigger button(s).

## Demo
[View on CodePen](https://codepen.io/nonsalant/pen/MYwjvoo)

## Attributes
| Attribute        | Description |
|------------------|-------------|
| `popover`        | Hides the modal before any JS is loaded. You can skip it (because it's added automatically if missing) and add this somewhere in your CSS to avoid the initial flash of content: <br> `lazy-modal:not(:defined) { display: none; }` |
| `triggers`       | A CSS selector for the trigger button(s). |
| `inner-styles`   | A comma-separated list of paths to stylesheets (relative to the lazy-modal.js file or absolute URLs). |
| `inner-scripts`  | A comma-separated list of paths to scripts (relative to the lazy-modal.js file or absolute URLs). |
| `inner-content`  | A path to an HTML file (relative to the lazy-modal.js file) that will be loaded into the modal. |
| `close-button`   | If present adds an "x" button that closes the modal. You can skip this and add it manually (inside the modal element) with something like: <br> `<button onclick="this.closest('[popover]').hidePopover()" type="button"> Close </button>` |

## Importing the Component

Grab the lazy-modal folder and include the script:
```html
<script type="module" src="./lazy-modal/lazy-modal.js"></script>
```

Alternatively, you can grab everything as a single JS file from the [CodePen demo](https://codepen.io/nonsalant/pen/MYwjvoo) (the code in JS tab), where utility functions are included at the bottom, and the `#closeButton` and `#modalCss` private properties include all the code from the other asset files in the lazy-modal folder.

## Usage

### Basic Usage (content inside the modal HTML)
The paths to for `inner-styles` and `inner-scripts` attributes can be paths relative to the **lazy-modal/lazy-modal.js** file, or absolute URLs.
```html
<button class="my-trigger" type="button">Open the Popover</button>
<lazy-modal popover
    triggers=".my-trigger"
    inner-styles="../path/to/my-modal.css"
    inner-scripts="https://example.com/my-modal.js"
    close-button
>
    <!-- HTML goes here -->
</lazy-modal>
```

### Client-Side Rendering the Modal Content
The path for the `inner-content` attribute (pointing to an HTML file) needs to be relative to the **lazy-modal/lazy-modal.js** file.
```html
<button class="my-trigger" type="button">Open the Popover</button>
<lazy-modal popover
    triggers=".my-trigger"
    inner-content="../path/to/my-modal.html"
    inner-styles="../path/to/my-modal.css"
    inner-scripts="../path/to/my-modal.js"
    close-button
>
</lazy-modal>
```
(See the examples/csr-demo.html file for a complete example.)

### Server-Side Rendering the Modal Content (PHP Example)
The path to the included content (HTML or another PHP file) needs to be relative to the current PHP file.
```html
<button class="my-trigger" type="button">Open the Popover</button>
<lazy-modal popover
    triggers=".my-trigger"
    inner-styles="../path/to/my-modal.css"
    inner-scripts="../path/to/my-modal.js"
    close-button
>
    <?php include 'path/to/my-modal.html'; ?>
</lazy-modal>
```
(See the examples/ssr-demo.php file for a complete example.)
