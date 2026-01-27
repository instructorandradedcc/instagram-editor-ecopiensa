import { ImageLayer, TextLayer } from './layers.js';

export class Editor {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // State
        this.layers = [];
        this.activeLayer = null;

        // Canvas Config & Guides
        this.canvas.width = 1080;
        this.canvas.height = 1080;
        this.backgroundColor = '#1a1a1a';
        this.guides = []; // Stores current safe lines {x, y, vertical: bool}

        // Tools
        this.currentTool = 'move';
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffset = { x: 0, y: 0 };
        this.resizeHandle = null;

        this.wandTolerance = 30;

        this.initEvents();
        this.render();
    }

    initEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.handleDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleUp(e));

        this.canvas.addEventListener('touchstart', (e) => this.handleDown(e.touches[0]));
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleMove(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => this.handleUp(e));

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

    // --- Rendering & Smart Guides ---

    render() {
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.layers.forEach(layer => {
            layer.render(this.ctx);
        });

        // Draw Smart Guides
        if (this.guides.length > 0) {
            this.ctx.save();
            this.ctx.strokeStyle = '#00aaff'; // Blue line requested
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);

            this.guides.forEach(g => {
                this.ctx.beginPath();
                if (g.vertical) {
                    this.ctx.moveTo(g.pos, 0);
                    this.ctx.lineTo(g.pos, this.canvas.height);
                } else {
                    this.ctx.moveTo(0, g.pos);
                    this.ctx.lineTo(this.canvas.width, g.pos);
                }
                this.ctx.stroke();
            });
            this.ctx.restore();
        }

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

        ctx.translate(centerX, centerY);
        ctx.rotate(layer.rotation);
        ctx.translate(-centerX, -centerY);

        ctx.strokeStyle = '#00ff9d';
        ctx.lineWidth = 2;
        ctx.strokeRect(layer.x, layer.y, w, h);

        const handleSize = 12;

        // Resize Handle
        ctx.fillStyle = '#fff';
        ctx.fillRect(layer.x + w - handleSize / 2, layer.y + h - handleSize / 2, handleSize, handleSize);

        // Rotate Handle
        ctx.beginPath();
        ctx.moveTo(centerX, layer.y);
        ctx.lineTo(centerX, layer.y - 30);
        ctx.strokeStyle = '#00ff9d';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(centerX, layer.y - 30, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff9d';
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

        if (this.activeLayer) {
            const l = this.activeLayer;
            const w = l.width * l.scaleX;
            const h = l.height * l.scaleY;
            const handleSize = 30;

            // Resize (BR)
            if (
                pos.x >= l.x + w - handleSize && pos.x <= l.x + w + handleSize &&
                pos.y >= l.y + h - handleSize && pos.y <= l.y + h + handleSize
            ) {
                this.isResizing = true;
                this.resizeHandle = 'br';
                return;
            }

            // Rotate (Top)
            if (
                pos.x >= l.x + w / 2 - handleSize && pos.x <= l.x + w / 2 + handleSize &&
                pos.y >= l.y - 45 && pos.y <= l.y - 15
            ) {
                this.isResizing = true;
                this.resizeHandle = 'rotate';
                return;
            }
        }

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
        this.guides = []; // Reset guides

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
                const angle = Math.atan2(pos.y - centerY, pos.x - centerX);
                l.rotation = angle + Math.PI / 2;
                this.render();
            }
        } else if (this.isDragging && this.activeLayer) {
            if (this.currentTool === 'move') {
                let nextX = pos.x - this.dragOffset.x;
                let nextY = pos.y - this.dragOffset.y;

                // --- Smart Guides Logic ---
                const snapThreshold = 10;
                const l = this.activeLayer;
                const w = l.width * l.scaleX;
                const h = l.height * l.scaleY;

                // Centers
                const centerX = nextX + w / 2;
                const centerY = nextY + h / 2;

                // Snap to Canvas Center
                if (Math.abs(centerX - this.canvas.width / 2) < snapThreshold) {
                    nextX = this.canvas.width / 2 - w / 2;
                    this.guides.push({ vertical: true, pos: this.canvas.width / 2 });
                }
                if (Math.abs(centerY - this.canvas.height / 2) < snapThreshold) {
                    nextY = this.canvas.height / 2 - h / 2;
                    this.guides.push({ vertical: false, pos: this.canvas.height / 2 });
                }

                // Snap to other Layers (Edges)
                this.layers.forEach(other => {
                    if (other === l) return;
                    const ow = other.width * other.scaleX;
                    const oh = other.height * other.scaleY;

                    // Top Align
                    if (Math.abs(nextY - other.y) < snapThreshold) {
                        nextY = other.y;
                        this.guides.push({ vertical: false, pos: other.y });
                    }
                    // Bottom Align
                    // Left Align
                    if (Math.abs(nextX - other.x) < snapThreshold) {
                        nextX = other.x;
                        this.guides.push({ vertical: true, pos: other.x });
                    }
                });

                this.activeLayer.x = nextX;
                this.activeLayer.y = nextY;
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
        this.guides = []; // Clear lines on drop
        this.render();
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
