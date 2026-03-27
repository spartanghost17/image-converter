namespace image_converter.Models
{
    /// <summary>
    /// Metadata about an uploaded image, returned before conversion
    /// so the frontend can show dimensions, alpha status, and original size.
    /// </summary>
    public record ImageInfo
    (
        int Width,
        int Height,
        bool HasAlpha,
        int Channels,
        long OriginalSize
    );
}
