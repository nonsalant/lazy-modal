# &lt;lazy-modal&gt; web component

A popover that starts loading related assets (and, optionally, the content inside) when you hover or focus its trigger button(s).

## Demo
[View a demo implementation on CodePen](https://codepen.io/nonsalant/pen/MYwjvoo)

[![screenshot from the codepen demo](examples/codepen-demo.png)](https://codepen.io/nonsalant/pen/MYwjvoo)
*The demo shows two 3rd party web components ([storage-form](https://github.com/daviddarnes/storage-form) and [action-table](https://github.com/colinaut/action-table)) lazily loaded from CDNs when opened in popover modals*

## Attributes
| Attribute        | Description |
|------------------|-------------|
| `triggers`       | Required attribute: A CSS selector for the trigger button(s). |
| `inner-styles`   | A comma-separated list of paths to stylesheets (relative to the lazy-modal.js file or absolute URLs). |
| `inner-scripts`  | A comma-separated list of paths to scripts (relative to the lazy-modal.js file or absolute URLs). |
| `inner-content`  | A path to an HTML file (relative to the lazy-modal.js file) that will be injected into the modal. |
| `popover`        | This [native attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover) hides the modal before any JS is loaded. You can skip adding this to each modal (because it's added automatically if missing) and add this style somewhere in your CSS to avoid the initial flash of content: <br> `lazy-modal:not(:defined) { display: none; }` |
| `close-button`   | If present adds an "x" button that closes the modal. You can skip this and add it manually (inside the modal element) with something like: <br> `<button onclick="this.closest('[popover]').hidePopover()" type="button"> Close </button>` |
| `load-on`        | Possible values: <br>• `click` - the modal will load everything when a trigger is clicked. <br>• `hover` (default) - the modal will load everything when a trigger is hovered or focused. <br>• `visible` - the modal will load everything when a trigger becomes visible in the viewport. <br>• `load` - the modal will load everything immediately without looking for a trigger.|
| `in-head`        | If present, the modal's styles and scripts will be added to the `<head>` of the document instead of inside the modal element. |

## Importing the component from local files

Grab the lazy-modal folder from this repo and include the script:
```html
<script type="module" src="./lazy-modal/lazy-modal.js"></script>
```

Alternatively, you can grab everything as a single JavaScript file from the [CodePen demo](https://codepen.io/nonsalant/pen/MYwjvoo) (all the code in the JS tab), where utility functions are included at the bottom, and the `#closeButton` and `#modalCss` private properties include all the code from the other asset files in the lazy-modal folder.

## Importing the component from a CDN
```html
<script type="module" src="https://unpkg.com/lazy-modal/lazy-modal/lazy-modal.js"></script>
```

## Usage

### Basic Usage (content inside the modal HTML)
The paths to for `inner-styles` and `inner-scripts` attributes can be paths relative to the **lazy-modal.js** file, or absolute URLs.
```html
<button class="my-trigger" type="button">Open the Popover</button>
<lazy-modal popover
    triggers=".my-trigger"
    inner-styles="../path/to/example.css"
    inner-scripts="https://example.com/example.js"
    close-button
>
    <!-- HTML goes here -->
</lazy-modal>
```

### Client-Side Rendering the Modal Content
The path for the `inner-content` attribute (pointing to an HTML file) needs to be relative to the **lazy-modal.js** file.
```html
<button class="my-trigger" type="button">Open the Popover</button>
<lazy-modal popover
    triggers=".my-trigger"
    inner-content="../path/to/example.html"
    inner-styles="../path/to/example.css"
    inner-scripts="../path/to/example.js"
    close-button
></lazy-modal>
```
(See the examples/csr-demo.html file for a working example.)

### Server-Side Rendering the Modal Content (PHP Example)
The path to the included content (HTML or another PHP file) needs to be relative to the current PHP file.
```php
<button class="my-trigger" type="button">Open the Popover</button>
<lazy-modal popover
    triggers=".my-trigger"
    inner-styles="../path/to/example.css"
    inner-scripts="../path/to/example.js"
    close-button
>
    <?php include 'path/to/example.html'; ?>
</lazy-modal>
```
(See the examples/ssr-demo.php file for a working example.)

### Client-Side Lazy Rendering the Modal Content
To lazy render the modal content, you can wrap it in a `<template>` tag. The content (initially inert) will be cloned and appended to the modal the first time the modal trigger is hovered/focused/clicked or if the popover is shown in some other way.

This can be useful for heavyweight or stateful components that you don't want to instantiate eagerly.

```html
<button class="my-trigger" type="button">Open the Popover</button>
<lazy-modal popover
    triggers=".my-trigger"
    inner-styles="../path/to/example.css"
    inner-scripts="../path/to/example.js"
    close-button
>
    <template>
        <!-- HTML goes here -->
    </template>
</lazy-modal>
```
(See the examples/lazy-render-demo.php file for a working example -- lazy rendering happens client-side, but the content inside the templates is included server-side to keep the example short and readable.)
