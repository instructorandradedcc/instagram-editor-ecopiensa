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

    // File Upload Handling
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
        }
    });

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
    const optionsGroups = document.querySelectorAll('.options-group');

    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            toolBtns.forEach(b => b.classList.remove('active'));
            // Add to clicked
            btn.classList.add('active');

            const tool = btn.dataset.tool;
            let editorTool = tool;

            // Mapping
            if (tool === 'text') {
                editor.addTextLayer();
                editorTool = 'move';
            } else if (tool === 'magic-wand') {
                editorTool = 'wand';
                alert('Herramienta Varita Mágica: Haz clic en el color del fondo que quieras borrar.');
            } else if (tool === 'bucket') {
                editorTool = 'bucket';
                alert('Rellenar: Haz clic para pintar un área del color Blanco (Por defecto).');
            } else if (tool === 'crop') {
                editorTool = 'move';
            }

            editor.setTool(editorTool);
            showProperties(tool);
        });
    });

    function showProperties(toolName) {
        // Hide all specific option groups
        document.getElementById('crop-options').classList.add('hidden');
        document.getElementById('text-options').classList.add('hidden');

        // Always show general options (Align/Order) unless specific tool obscures it
        // Actually, alignment is useful for everything.

        hintText.style.display = 'none';

        if (toolName === 'crop') {
            document.getElementById('crop-options').classList.remove('hidden');
        } else if (toolName === 'text') {
            document.getElementById('text-options').classList.remove('hidden');
        } else {
            // Default hint
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

    fontSizeInput.addEventListener('input', updateTextProps);
    colorInput.addEventListener('input', updateTextProps);
    fontSelect.addEventListener('change', updateTextProps);

    // Alignment Controls
    document.getElementById('btn-center').addEventListener('click', () => editor.alignSelectedLayer('center'));
    document.getElementById('btn-back').addEventListener('click', () => editor.sendToBack());
    document.getElementById('btn-front').addEventListener('click', () => editor.bringToFront());

    // Grid Preview Logic
    document.getElementById('btn-batch').addEventListener('click', () => {
        const modal = document.getElementById('grid-modal');
        const img = document.getElementById('current-preview');
        img.src = editor.export(); // Use current working image
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
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('SW registered: ', registration);
            }).catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        });
    }
});
