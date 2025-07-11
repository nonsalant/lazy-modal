<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lazy Modal Demo</title>
    <script type="module" src="../lazy-modal/lazy-modal.js"></script>
</head>
<body>
    <hgroup>
        <h1>&lt;lazy-modal&gt;</h1>
        <p>Starts loading assets when you hover or focus the modal trigger buttons.</p>
        <p>Check the <strong>Network</strong> tab in the browser's Dev Tools.</p>
    </hgroup>

    <hr>

    <!-- TRIGGERS -->
    <p>
        <button class="storage-trigger" type="button">Storage Form</button>
        <button class="table-trigger" type="button">Action Table</button>
    </p>

    <!-- MODALS -->

    <!-- storage form demo from: https://github.com/daviddarnes/storage-form -->
    <lazy-modal popover
        triggers=".storage-trigger"
        close-button  in-head
        inner-scripts="https://www.unpkg.com/@daviddarnes/storage-form@2.0.1/storage-form.js"
    >
        <template>
            <?php include 'content/storage-form.html'; ?>
        </template>
    </lazy-modal>

    <!-- action table demo from: https://github.com/colinaut/action-table -->
    <lazy-modal popover
        triggers=".table-trigger"
        close-button in-head
        inner-styles="https://unpkg.com/@colinaut/action-table/dist/action-table.css" 
        inner-scripts="https://unpkg.com/@colinaut/action-table/dist/index.js, 
            https://unpkg.com/@colinaut/action-table/dist/action-table-switch.js"
    >
        <template>
            <?php include 'content/action-table.html'; ?>
        </template>
    </lazy-modal>
</body>
</html>