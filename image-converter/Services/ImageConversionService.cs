//using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Advanced;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp;
using ImageInfo = image_converter.Models.ImageInfo;

namespace image_converter.Services
{
    /// <summary>
    /// Image conversion service.
    ///
    /// THE CORE LOGIC:
    /// 1. Decode source bytes → Image<Rgba32> (raw pixel grid in memory)
    /// 2. Handle alpha channel: JPG has no transparency, so composite onto white
    /// 3. Encode to JPG with user-specified quality (0–100 in ImageSharp, mapped from 0.0–1.0)
    ///
    /// Under the hood, ImageSharp's JpegEncoder performs the same JPEG pipeline:
    ///   - RGB → YCbCr color space conversion (Y = 0.299R + 0.587G + 0.114B, etc.)
    ///   - Chroma subsampling (4:2:0 at quality ≤ 90, 4:4:4 at higher quality)
    ///   - 8×8 block DCT (Discrete Cosine Transform)
    ///   - Quantization (controlled by the Quality property)
    ///   - Huffman entropy coding
    ///
    /// KEY DIFFERENCE FROM JAVA:
    /// Java's ImageIO uses int-packed ARGB pixels (0xAARRGGBB in a single int).
    /// ImageSharp uses strongly-typed pixel structs — Rgba32 has separate R, G, B, A byte fields.
    /// The underlying data is the same grid of numbers, just accessed differently.
    /// </summary>
    public class ImageConversionService
    {
        /// <summary>
        /// Convert any supported image format to JPG.
        /// </summary>
        /// <param name="imageBytes">Raw bytes of the source image (PNG, WebP, TIFF, BMP, GIF, etc.)</param>
        /// <param name="quality">JPEG quality: 0.0 (smallest, worst) to 1.0 (largest, best)</param>
        /// <returns>Byte array containing the JPEG-encoded image</returns>
        public byte[] ConvertToJpg(byte[] imageBytes, float quality)
        {
            // --- STEP 1: DECODE ---
            // Image.Load() detects the format from magic bytes in the header
            // (same as Java's ImageIO.read()), then decodes into an Image<Rgba32>.
            //
            // An Image<Rgba32> is essentially:
            //   Rgba32[width, height]  — a 2D grid where each Rgba32 has R, G, B, A bytes
            //   Width, Height          — dimensions of the grid
            //   PixelType              — how to interpret the bytes
            //
            // Rgba32 layout per pixel: [R: 0-255] [G: 0-255] [B: 0-255] [A: 0-255]
            // Compare to Java's int-packed: 0xAARRGGBB — same data, different encoding.
            using var image = Image.Load<Rgba32>(imageBytes);

            // --- STEP 2: HANDLE ALPHA (TRANSPARENCY) ---
            // Same problem as Java: JPG has no alpha channel.
            // PNG pixel: Rgba32(R=255, G=0, B=0, A=0) = fully transparent red
            // If we just strip the alpha, the encoder sees (255, 0, 0) = red, not transparent.
            // Worse: some encoders interpret A=0 as "undefined RGB" → black pixels.
            //
            // The fix: composite onto a white background using alpha blending.
            // For each pixel, the blend formula is:
            //   out.R = (pixel.A / 255) * pixel.R + (1 - pixel.A / 255) * 255
            //   out.G = (pixel.A / 255) * pixel.G + (1 - pixel.A / 255) * 255
            //   out.B = (pixel.A / 255) * pixel.B + (1 - pixel.A / 255) * 255
            //
            // ImageSharp's BackgroundColor processor handles this automatically.
            // It draws a solid color behind the image, which triggers alpha compositing.
            if (HasAlphaChannel(image))
            {
                // Create white background and draw the image on top.
                // This composites: transparent → white, semi-transparent → blended.
                image.Mutate(ctx => ctx.BackgroundColor(Color.White));
            }

            // --- STEP 3: ENCODE TO JPG ---
            // ImageSharp's JpegEncoder triggers the full JPEG math pipeline:
            //
            // 1. RGB → YCbCr color space:
            //      Y  =  0.299 * R + 0.587 * G + 0.114 * B
            //      Cb = -0.168736 * R - 0.331264 * G + 0.5 * B + 128
            //      Cr =  0.5 * R - 0.418688 * G - 0.081312 * B + 128
            //
            // 2. Chroma subsampling:
            //      Quality ≤ 90 → 4:2:0 (Cb/Cr at quarter resolution)
            //      Quality > 90 → 4:4:4 (full resolution color)
            //      ImageSharp auto-selects based on quality. You can override with
            //      encoder.ColorType = JpegEncodingColor.YCbCrRatio420 (or 444).
            //
            // 3. DCT per 8×8 block:
            //      F(u,v) = (1/4) C(u) C(v) Σx Σy f(x,y) cos[π(2x+1)u/16] cos[π(2y+1)v/16]
            //      Same math as Java — both implement JPEG's baseline DCT-II.
            //
            // 4. Quantization:
            //      F_q(u,v) = round(F(u,v) / Q(u,v))
            //      The Quality property (1–100) scales the standard quantization tables.
            //      Higher quality → smaller Q values → more coefficients survive → bigger file.
            //
            // 5. Huffman coding:
            //      Lossless compression of the zigzag-scanned quantized coefficients.
            //      ImageSharp also supports arithmetic coding (InterleaveMode).
            int jpegQuality = Math.Clamp((int)(quality * 100), 1, 100);

            var encoder = new JpegEncoder
            {
                Quality = jpegQuality,
                // ColorType auto-selects:
                //   ≤ 90 quality → YCbCr 4:2:0 (smaller files)
                //   > 90 quality → YCbCr 4:4:4 (better color fidelity)
            };

            using var outputStream = new MemoryStream();
            image.Save(outputStream, encoder);
            return outputStream.ToArray();
        }


        /// <summary>
        /// Get metadata about the source image before conversion.
        /// </summary>
        public ImageInfo GetImageInfo(byte[] imageBytes)
        {
            using var image = Image.Load<Rgba32>(imageBytes);
            return new ImageInfo(
                Width: image.Width,
                Height: image.Height,
                HasAlpha: HasAlphaChannel(image),
                Channels: HasAlphaChannel(image) ? 4 : 3,
                OriginalSize: imageBytes.Length
            );
        }

        /// <summary>
        /// Check if any pixel in the image has a non-opaque alpha value.
        ///
        /// We don't just check the pixel format — some PNGs are saved as RGBA
        /// but every pixel has A=255 (fully opaque). In that case, no compositing
        /// is needed. We scan a sample of pixels to check.
        ///
        /// For large images, checking every pixel would be slow, so we sample
        /// every 4th row and every 4th column (1/16th of the image).
        /// </summary>
        private static bool HasAlphaChannel(Image<Rgba32> image)
        {
            // Sample pixels to detect actual transparency (not just format capability)
            for (int y = 0; y < image.Height; y += 4)
            {
                var row = image.DangerousGetPixelRowMemory(y).Span;
                for (int x = 0; x < image.Width; x += 4)
                {
                    if (row[x].A < 255)
                        return true;
                }
            }
            return false;
        }
    }
}
