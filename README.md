# lazy-modal web component

Popover starts loading assets when you hover or focus its trigger button(s).

## Demo
[View on CodePen](https://codepen.io/nonsalant/pen/MYwjvoo)

## Usage

```html
<button class="my-trigger" type="button">Storage Form</button>
<lazy-modal
    triggers=".my-trigger"
    inner-styles="https://example.com/modal-styles.css"
    inner-scripts="https://example.com/modal-scripts.js"
    close-button
>
    <!-- HTML goes here -->
</lazy-modal>
```