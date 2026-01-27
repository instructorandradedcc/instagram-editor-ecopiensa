/**
 * Layer System for Ecopiensa Editor
 * Defines the behavior of independent objects on the canvas.
 */

export class Layer {
    constructor(type) {
        this.id = Date.now() + Math.random();
        this.type = type; // 'image', 'text'
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.rotation = 0; // Radians
        this.scaleX = 1;
        this.scaleY = 1;
        this.opacity = 1;
        this.visible = true;
        this.locked = false;
        this.selected = false;
    }

    // Check if point x,y is inside this layer
    hitTest(x, y) {
        // Simple bounding box check (not accounting for rotation yet for simplicity)
        const left = this.x;
        const right = this.x + this.width * this.scaleX;
        const top = this.y;
        const bottom = this.y + this.height * this.scaleY;

        return x >= left && x <= right && y >= top && y <= bottom;
    }

    render(ctx) {
        // Base render method
    }
}

export class ImageLayer extends Layer {
    constructor(img) {
        super('image');
        this.img = img;
        this.sourceCanvas = document.createElement('canvas'); // Keep a discrete internal canvas for pixel manipulation
        this.sourceCtx = this.sourceCanvas.getContext('2d');

        // Initialize
        this.sourceCanvas.width = img.width;
        this.sourceCanvas.height = img.height;
        this.sourceCtx.drawImage(img, 0, 0);

        this.width = img.width;
        this.height = img.height;

        // Non-destructive Crop (source coordinates)
        this.crop = { x: 0, y: 0, w: img.width, h: img.height };
    }

    render(ctx) {
        if (!this.visible) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;

        // Transformations
        const w = this.width * this.scaleX;
        const h = this.height * this.scaleY;
        const centerX = this.x + w / 2;
        const centerY = this.y + h / 2;

        // Rotate around center
        ctx.translate(centerX, centerY);
        ctx.rotate(this.rotation);
        ctx.translate(-centerX, -centerY);

        ctx.translate(this.x, this.y);
        ctx.scale(this.scaleX, this.scaleY);

        // Render from internal source canvas (allows for pixel manipulation like eraser)
        ctx.drawImage(
            this.sourceCanvas,
            this.crop.x, this.crop.y, this.crop.w, this.crop.h, // Source (Cropped)
            0, 0, this.width, this.height // Destination (On main canvas)
        );

        ctx.restore();
    }

    // Magic Wand / Remove Background Logic
    removeColor(targetR, targetG, targetB, tolerance = 30) {
        const w = this.sourceCanvas.width;
        const h = this.sourceCanvas.height;
        const imageData = this.sourceCtx.getImageData(0, 0, w, h);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue; // Already transparent

            // Calc distance
            if (
                Math.abs(r - targetR) < tolerance &&
                Math.abs(g - targetG) < tolerance &&
                Math.abs(b - targetB) < tolerance
            ) {
                data[i + 3] = 0; // Set Alpha to 0
            }
        }

        this.sourceCtx.putImageData(imageData, 0, 0);
    }

    applyEraser(x, y, size) {
        // Simplified mapping (ignoring rotation for eraser for now)
        const localX = (x - this.x) / this.scaleX;
        const localY = (y - this.y) / this.scaleY;

        const sourceX = localX + this.crop.x;
        const sourceY = localY + this.crop.y;

        this.sourceCtx.save();
        this.sourceCtx.globalCompositeOperation = 'destination-out';
        this.sourceCtx.beginPath();
        this.sourceCtx.arc(sourceX, sourceY, size, 0, Math.PI * 2);
        this.sourceCtx.fill();
        this.sourceCtx.restore();
    }

    // Flood Fill (Bucket)
    floodFill(x, y, color) {
        // color: { r, g, b, a }
        // 1. Map to local space
        const localX = Math.floor((x - this.x) / this.scaleX + this.crop.x);
        const localY = Math.floor((y - this.y) / this.scaleY + this.crop.y);

        const w = this.sourceCanvas.width;
        const h = this.sourceCanvas.height;

        if (localX < 0 || localY < 0 || localX >= w || localY >= h) return;

        const imageData = this.sourceCtx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // Get target color
        const idx = (localY * w + localX) * 4;
        const startR = data[idx];
        const startG = data[idx + 1];
        const startB = data[idx + 2];
        const startA = data[idx + 3];

        // Avoid infinite loop if color matches
        if (startR === color.r && startG === color.g && startB === color.b && startA === color.a) return;

        const stack = [[localX, localY]];

        while (stack.length) {
            const [curX, curY] = stack.pop();
            const pos = (curY * w + curX) * 4;

            if (curX < 0 || curX >= w || curY < 0 || curY >= h) continue;

            // Check match (Tolerance could be added here similar to wand)
            if (
                Math.abs(data[pos] - startR) < 10 &&
                Math.abs(data[pos + 1] - startG) < 10 &&
                Math.abs(data[pos + 2] - startB) < 10 &&
                Math.abs(data[pos + 3] - startA) < 10
            ) {
                // Fill
                data[pos] = color.r;
                data[pos + 1] = color.g;
                data[pos + 2] = color.b;
                data[pos + 3] = color.a; // Usually 255

                stack.push([curX + 1, curY]);
                stack.push([curX - 1, curY]);
                stack.push([curX, curY + 1]);
                stack.push([curX, curY - 1]);
            }
        }

        this.sourceCtx.putImageData(imageData, 0, 0);
    }
}

export class TextLayer extends Layer {
    constructor(text = "Nuevo Texto", font = "Outfit", size = 60, color = "#ffffff") {
        super('text');
        this.text = text;
        this.font = font;
        this.size = size;
        this.color = color;
        this.align = 'center'; // left, center, right

        // Estimate size
        this.width = text.length * (size * 0.6);
        this.height = size;
    }

    render(ctx) {
        if (!this.visible) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;

        const w = this.width;
        const h = this.height;

        // Rotation support
        const centerX = this.x + (this.width * this.scaleX) / 2;
        const centerY = this.y + (this.height * this.scaleY) / 2;

        ctx.translate(centerX, centerY);
        ctx.rotate(this.rotation);
        ctx.translate(-centerX, -centerY);

        ctx.translate(this.x, this.y);
        ctx.scale(this.scaleX, this.scaleY);

        ctx.font = `${this.size}px ${this.font}`;
        ctx.fillStyle = this.color;
        ctx.textBaseline = 'top';

        // Shadow for style
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillText(this.text, 0, 0);

        const metrics = ctx.measureText(this.text);
        this.width = metrics.width;

        ctx.restore();
    }
}
