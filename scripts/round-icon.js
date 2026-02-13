
import { Jimp } from "jimp";
import path from "path";

const INPUT_PATH = path.join("src", "assets", "badrest1.png");
const OUTPUT_PATH = path.join("src", "assets", "badrest1_rounded.png");
const CORNER_RADIUS_PERCENT = 0.22; // Typical squircle radius factor
const ICON_SCALE = 0.80; // Scale down to 80% to provide padding

async function roundCorners() {
    try {
        console.log(`Reading image from ${INPUT_PATH}...`);
        const image = await Jimp.read(INPUT_PATH);
        const width = image.width;
        const height = image.height;

        // Create a new transparent canvas of the same size
        const canvas = new Jimp({ width, height, color: 0x00000000 });

        // Resize the original image
        const scaledWidth = width * ICON_SCALE;
        const scaledHeight = height * ICON_SCALE;

        console.log(`Resizing image to ${Math.floor(scaledWidth)}x${Math.floor(scaledHeight)}...`);

        // Calculate centering position
        const x = (width - scaledWidth) / 2;
        const y = (height - scaledHeight) / 2;

        // Composite the resized image onto the canvas

        // Now apply rounding to the canvas (which contains the resized image)
        // NOTE: We should actually round the *original* image before resizing to avoid cutting off already transparent pixels?
        // Actually, usually the mask is applied to the full canvas.
        // If we want the *logo itself* to be rounded, we should round 'image' before compositing.
        // If we want the *canvas* to be rounded (like an iOS icon), we round 'canvas'.
        // Typically, macOS icons are "shaped" images. If the logo is already square, and we just shrink it, 
        // it will be a floating square in a transparent box.
        // The user probably wants the LOGO ITSELF to be rounded AND padded.
        // So we should:
        // 1. Round the original full-size image.
        // 2. Resize the rounded image.
        // 3. Composite onto transparent canvas.

        // Wait, let's look at the previous logic. It was masking the corners of the FULL image.
        // If we shrink it, the corners of the *shrunken* image need to be rounded.
        // Actually, if we just shrink a square, we get a smaller square.
        // We want a smaller *rounded* square.

        // BETTER APPROACH:
        // 1. Create a rounded version of the ORIGINAL image (full bleed rounding).
        // 2. Resize that rounded image.
        // 3. Composite onto the canvas.

        // Re-reading the image to start fresh on the logic in memory (though we have 'image' variable)
        // Let's use 'image' as the source.

        // 1. Apply rounding to 'image' (the source logo)
        const radius = Math.min(image.width, image.height) * CORNER_RADIUS_PERCENT;

        image.scan(0, 0, image.width, image.height, (lx, ly, idx) => {
            let dist = 0;
            let inCorner = false;
            const w = image.width;
            const h = image.height;

            if (lx < radius && ly < radius) {
                dist = Math.sqrt(Math.pow(lx - radius, 2) + Math.pow(ly - radius, 2));
                inCorner = true;
            } else if (lx > w - radius && ly < radius) {
                dist = Math.sqrt(Math.pow(lx - (w - radius), 2) + Math.pow(ly - radius, 2));
                inCorner = true;
            } else if (lx < radius && ly > h - radius) {
                dist = Math.sqrt(Math.pow(lx - radius, 2) + Math.pow(ly - (h - radius), 2));
                inCorner = true;
            } else if (lx > w - radius && ly > h - radius) {
                dist = Math.sqrt(Math.pow(lx - (w - radius), 2) + Math.pow(ly - (h - radius), 2));
                inCorner = true;
            }

            if (inCorner && dist > radius) {
                image.bitmap.data[idx + 3] = 0;
            }
            if (inCorner && dist > radius - 1 && dist <= radius) {
                const alphaFn = (radius - dist);
                image.bitmap.data[idx + 3] = Math.floor(Math.min(image.bitmap.data[idx + 3], alphaFn * 255));
            }
        });

        // 2. Resize the now-rounded image
        // Jimp resizing might blur edges slightly, but it's fine for icons.
        // Using 'contain' or simple resize? Resize is fine.

        // We need to be careful: if we modify 'image' in place with scan, we can then resize it.
        image.resize({ w: scaledWidth, h: scaledHeight });

        // 3. Composite
        canvas.composite(image, x, y);

        console.log(`Writing final padded and rounded image to ${OUTPUT_PATH}...`);
        await canvas.write(OUTPUT_PATH);
        console.log("Done!");

    } catch (error) {
        console.error("Error processing image:", error);
        process.exit(1);
    }
}

roundCorners();
