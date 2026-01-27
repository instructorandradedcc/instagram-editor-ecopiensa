import { Editor } from './editor.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const canvas = document.getElementById('editor-canvas');
    const fileInput = document.getElementById('file-upload');
    const emptyState = document.getElementById('empty-state');
    const propertiesPanel = document.getElementById('properties-panel');
    const hintText = document.querySelector('.hint-text');

    // Initialize Editor
    const editor = new Editor(canvas);

    // 1. File Upload (Button & Input)
    // Both the empty state button and the sidebar "+" button trigger this input
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
            // Reset input so same file can be selected again
            fileInput.value = '';
        }
    });

    // Helper: Trigger upload when sidebar button clicked
    const btnAddImage = document.getElementById('btn-add-image');
    if (btnAddImage) {
        btnAddImage.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // Paste Handling (Ctrl+V)
    window.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.includes('image/')) {
                const blob = item.getAsFile();
                handleImageUpload(blob);
            }
        }
    });

    function handleImageUpload(file) {
        editor.addImageLayer(file).then(() => {
            // UI Update
            emptyState.style.display = 'none';
            // Show canvas
            canvas.style.display = 'block';
        });
    }

    // Drag and Drop
    const canvasWrapper = document.getElementById('canvas-wrapper');
    canvasWrapper.addEventListener('dragover', (e) => e.preventDefault());
    canvasWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageUpload(e.dataTransfer.files[0]);
        }
    });

    // Tool Switching Logic
    const toolBtns = document.querySelectorAll('.tool-btn');

    toolBtns.forEach(btn => {
        // Skip the "Add Image" button from the selection logic since it's an action, not a mode
        if (btn.id === 'btn-add-image') return;

        btn.addEventListener('click', () => {
            // Remove active class from all
            toolBtns.forEach(b => {
                if (b.id !== 'btn-add-image') b.classList.remove('active');
            });
            // Add to clicked
            btn.classList.add('active');

            const tool = btn.dataset.tool;
            let editorTool = tool; // Default map

            // Special mappings
            if (tool === 'text') {
                editor.addTextLayer();
                editorTool = 'move'; // Switch back to move after adding
            } else if (tool === 'magic-wand') {
                editorTool = 'wand';
                // alert('Varita: Clic en el color a borrar');
            } else if (tool === 'bucket') {
                editorTool = 'bucket';
                // alert('Bote: Clic para rellenar de blanco');
            } else if (tool === 'crop') {
                editorTool = 'move';
            }

            editor.setTool(editorTool);
            showProperties(tool);
        });
    });

    function showProperties(toolName) {
        const cropOpts = document.getElementById('crop-options');
        const textOpts = document.getElementById('text-options');
        if (cropOpts) cropOpts.classList.add('hidden');
        if (textOpts) textOpts.classList.add('hidden');

        if (hintText) hintText.style.display = 'none';

        if (toolName === 'crop') {
            if (cropOpts) cropOpts.classList.remove('hidden');
        } else if (toolName === 'text') {
            if (textOpts) textOpts.classList.remove('hidden');
        }
    }

    // Font Properties
    const fontSizeInput = document.getElementById('font-size');
    const colorInput = document.getElementById('text-color');
    const fontSelect = document.getElementById('font-family');

    const updateTextProps = () => {
        if (editor.activeLayer && editor.activeLayer.type === 'text') {
            editor.activeLayer.size = parseInt(fontSizeInput.value);
            editor.activeLayer.color = colorInput.value;
            editor.activeLayer.font = fontSelect.value;
            editor.render();
        }
    };

    if (fontSizeInput) fontSizeInput.addEventListener('input', updateTextProps);
    if (colorInput) colorInput.addEventListener('input', updateTextProps);
    if (fontSelect) fontSelect.addEventListener('change', updateTextProps);

    // Alignment Controls
    document.getElementById('btn-center').addEventListener('click', () => editor.alignSelectedLayer('center'));
    document.getElementById('btn-back').addEventListener('click', () => editor.sendToBack());
    document.getElementById('btn-front').addEventListener('click', () => editor.bringToFront());

    // Grid Preview Logic
    document.getElementById('btn-batch').addEventListener('click', () => {
        const modal = document.getElementById('grid-modal');
        const img = document.getElementById('current-preview');
        img.src = editor.export();
        modal.style.display = 'flex';
    });

    document.getElementById('btn-close-grid').addEventListener('click', () => {
        document.getElementById('grid-modal').style.display = 'none';
    });

    // Export
    document.getElementById('btn-export').addEventListener('click', () => {
        const formatSelect = document.getElementById('export-format');
        const format = formatSelect ? formatSelect.value : 'image/png';

        const dataUrl = editor.export(format, 0.9);

        const link = document.createElement('a');
        const ext = format.split('/')[1];
        link.download = `ecopiensa-art.${ext}`;
        link.href = dataUrl;
        link.click();
    });

    // PWA Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then(registration => { // Relative path
                console.log('SW registered');
            }).catch(err => {
                console.log('SW failed', err);
            });
        });
    }
});
