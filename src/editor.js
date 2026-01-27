import { ImageLayer, TextLayer } from './layers.js';

export class Editor {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // State
        this.layers = [];
        this.activeLayer = null;
        this.history = [];

        // Canvas Config
        this.canvas.width = 1080;
        this.canvas.height = 1080;
        this.backgroundColor = '#1a1a1a'; // Default background

        // Tools
        this.currentTool = 'move'; // move, wand, eraser, text, bucket
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffset = { x: 0, y: 0 };
        this.resizeHandle = null; // 'br', 'rotate'

        // Magic Wand settings
        this.wandTolerance = 30;

        this.initEvents();
        this.render();
    }

    initEvents() {
        // Mouse
        this.canvas.addEventListener('mousedown', (e) => this.handleDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleUp(e));

        // Touch
        this.canvas.addEventListener('touchstart', (e) => {
            // e.preventDefault();
            this.handleDown(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleMove(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => this.handleUp(e));

        // Keyboard (Delete)
        window.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.activeLayer) {
                this.deleteActiveLayer();
            }
        });
    }

    // --- Layer Management ---

    async addImageLayer(source) {
        let img;
        if (source instanceof File) {
            img = await this.fileToImage(source);
        } else if (source instanceof HTMLImageElement) {
            img = source;
        } else if (typeof source === 'string') {
            img = await this.urlToImage(source);
        }

        if (img) {
            const layer = new ImageLayer(img);
            if (layer.width > this.canvas.width) {
                const ratio = this.canvas.width / layer.width;
                layer.scaleX = ratio * 0.8;
                layer.scaleY = ratio * 0.8;
            }

            layer.x = (this.canvas.width - layer.width * layer.scaleX) / 2;
            layer.y = (this.canvas.height - layer.height * layer.scaleY) / 2;

            this.layers.push(layer);
            this.setActiveLayer(layer);
            this.render();
        }
    }

    addTextLayer() {
        const layer = new TextLayer("Doble clic...");
        layer.x = this.canvas.width / 2 - 100;
        layer.y = this.canvas.height / 2;
        this.layers.push(layer);
        this.setActiveLayer(layer);
        this.render();
    }

    deleteActiveLayer() {
        if (!this.activeLayer) return;
        this.layers = this.layers.filter(l => l !== this.activeLayer);
        this.activeLayer = null;
        this.render();
    }

    setActiveLayer(layer) {
        this.layers.forEach(l => l.selected = false);
        this.activeLayer = layer;
        if (layer) layer.selected = true;
    }

    // --- Alignment & Z-Index ---

    alignSelectedLayer(alignment) {
        if (!this.activeLayer) return;
        const l = this.activeLayer;
        const w = l.width * l.scaleX;
        const h = l.height * l.scaleY;

        if (alignment === 'center') {
            l.x = (this.canvas.width - w) / 2;
            l.y = (this.canvas.height - h) / 2;
        } else if (alignment === 'horizontal') {
            l.x = (this.canvas.width - w) / 2;
        } else if (alignment === 'vertical') {
            l.y = (this.canvas.height - h) / 2;
        }
        this.render();
    }

    sendToBack() {
        if (!this.activeLayer) return;
        const index = this.layers.indexOf(this.activeLayer);
        if (index > 0) {
            this.layers.splice(index, 1);
            this.layers.unshift(this.activeLayer);
            this.render();
        }
    }

    bringToFront() {
        if (!this.activeLayer) return;
        const index = this.layers.indexOf(this.activeLayer);
        if (index < this.layers.length - 1) {
            this.layers.splice(index, 1);
            this.layers.push(this.activeLayer);
            this.render();
        }
    }

    // --- Utilities ---

    fileToImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // --- Rendering ---

    render() {
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.layers.forEach(layer => {
            layer.render(this.ctx);
        });

        if (this.activeLayer) {
            this.drawSelection(this.activeLayer);
        }
    }

    drawSelection(layer) {
        const ctx = this.ctx;
        ctx.save();

        const w = layer.width * layer.scaleX;
        const h = layer.height * layer.scaleY;
        const centerX = layer.x + w / 2;
        const centerY = layer.y + h / 2;

        // Transform to match layer rotation
        ctx.translate(centerX, centerY);
        ctx.rotate(layer.rotation);
        ctx.translate(-centerX, -centerY);

        // Box
        ctx.strokeStyle = '#00ff9d';
        ctx.lineWidth = 2;
        ctx.strokeRect(layer.x, layer.y, w, h);

        // BR Handle (Resize)
        const handleSize = 12;
        ctx.fillStyle = '#fff';
        ctx.fillRect(layer.x + w - handleSize / 2, layer.y + h - handleSize / 2, handleSize, handleSize);

        // Rotation Handle Logic (Visual Stick Top)
        ctx.beginPath();
        ctx.moveTo(centerX, layer.y);
        ctx.lineTo(centerX, layer.y - 30);
        ctx.strokeStyle = '#00ff9d';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, layer.y - 30, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff9d'; // Neon green handle
        ctx.fill();

        ctx.restore();
    }

    // --- Interaction ---

    getPointerPos(e) {
        if (!e) return { x: 0, y: 0 };
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    handleDown(e) {
        const pos = this.getPointerPos(e);

        // 1. Check for Handles
        if (this.activeLayer) {
            const l = this.activeLayer;
            const w = l.width * l.scaleX;
            const h = l.height * l.scaleY;
            const handleSize = 30; // Hitbox radius

            // BR Handle (Resize)
            if (
                pos.x >= l.x + w - handleSize && pos.x <= l.x + w + handleSize &&
                pos.y >= l.y + h - handleSize && pos.y <= l.y + h + handleSize
            ) {
                this.isResizing = true;
                this.resizeHandle = 'br';
                return;
            }

            // Rotate Handle (Top Center - 30px up)
            if (
                pos.x >= l.x + w / 2 - handleSize && pos.x <= l.x + w / 2 + handleSize &&
                pos.y >= l.y - 45 && pos.y <= l.y - 15
            ) {
                this.isResizing = true;
                this.resizeHandle = 'rotate';
                return;
            }
        }

        // 2. Check for Layer Hits
        let hitLayer = null;
        for (let i = this.layers.length - 1; i >= 0; i--) {
            if (this.layers[i].hitTest(pos.x, pos.y)) {
                hitLayer = this.layers[i];
                break;
            }
        }

        if (hitLayer) {
            this.setActiveLayer(hitLayer);

            if (this.currentTool === 'wand' && hitLayer.type === 'image') {
                const p = this.getPixelColor(hitLayer, pos.x, pos.y);
                if (p) {
                    hitLayer.removeColor(p.r, p.g, p.b, this.wandTolerance);
                    this.render();
                }
            } else if (this.currentTool === 'bucket' && hitLayer.type === 'image') {
                // Default to white fill
                // In real app, prompt for color or use picked color
                hitLayer.floodFill(pos.x, pos.y, { r: 255, g: 255, b: 255, a: 255 });
                this.render();
            } else if (this.currentTool === 'eraser' && hitLayer.type === 'image') {
                this.isDragging = true;
                hitLayer.applyEraser(pos.x, pos.y, 20);
                this.render();
            } else {
                this.isDragging = true;
                this.dragOffset = {
                    x: pos.x - hitLayer.x,
                    y: pos.y - hitLayer.y
                };
            }
        } else {
            this.setActiveLayer(null);
            this.render();
        }
    }

    handleMove(e) {
        const pos = this.getPointerPos(e);

        if (this.isResizing && this.activeLayer) {
            const l = this.activeLayer;
            if (this.resizeHandle === 'br') {
                const newW = pos.x - l.x;
                const ratio = l.width / l.height;
                const newH = newW / ratio;
                l.scaleX = Math.max(0.1, newW / l.width);
                l.scaleY = Math.max(0.1, newH / l.height);
                this.render();
            } else if (this.resizeHandle === 'rotate') {
                const centerX = l.x + (l.width * l.scaleX) / 2;
                const centerY = l.y + (l.height * l.scaleY) / 2;
                // Calculate angle from center to mouse
                const angle = Math.atan2(pos.y - centerY, pos.x - centerX);
                // Adjust because handle is at -90deg (top)
                l.rotation = angle + Math.PI / 2;
                this.render();
            }
        } else if (this.isDragging && this.activeLayer) {
            if (this.currentTool === 'move') {
                this.activeLayer.x = pos.x - this.dragOffset.x;
                this.activeLayer.y = pos.y - this.dragOffset.y;
                this.render();
            } else if (this.currentTool === 'eraser' && this.activeLayer.type === 'image') {
                this.activeLayer.applyEraser(pos.x, pos.y, 20);
                this.render();
            }
        }
    }

    handleUp(e) {
        this.isDragging = false;
        this.isResizing = false;
        this.resizeHandle = null;
    }

    getPixelColor(layer, globalX, globalY) {
        const localX = (globalX - layer.x) / layer.scaleX;
        const localY = (globalY - layer.y) / layer.scaleY;

        if (localX < 0 || localY < 0 || localX > layer.width || localY > layer.height) return null;

        const data = layer.sourceCtx.getImageData(localX + layer.crop.x, localY + layer.crop.y, 1, 1).data;
        return { r: data[0], g: data[1], b: data[2], a: data[3] };
    }

    export(format = 'image/png', quality = 1.0) {
        this.setActiveLayer(null);
        this.render();
        const data = this.canvas.toDataURL(format, quality);
        this.setActiveLayer(this.activeLayer);
        return data;
    }
}
