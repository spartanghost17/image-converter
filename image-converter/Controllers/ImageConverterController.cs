using image_converter.Models;
using image_converter.Services;
using Microsoft.AspNetCore.Mvc;

namespace image_converter.Controllers
{

    [ApiController]
    [Route("api")]
    public class ImageConverterController : ControllerBase
    {
        private readonly ImageConversionService _conversionService;

        public ImageConverterController(ImageConversionService conversionService) 
        { 
            _conversionService = conversionService;
        }

        [HttpPost("Convert")]
        [RequestSizeLimit(50 * 1024 * 1024)] // 50 MB
        public async Task<IActionResult> ConvertToJpg(IFormFile file, [FromForm] float quality = 0.85f)
        {
            // validate
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "No file provuded", message = "Please upload an image file." });
            
            quality = Math.Clamp(quality, 0.0f, 1.0f);

            try
            {
                // Read file bytes into memory.
                // In Spring Boot: file.getBytes()
                // In ASP.NET Core: read from the stream into a byte array.
                byte[] imageBytes;
                using (var ms = new MemoryStream()) 
                { 
                    await file.CopyToAsync(ms);
                    imageBytes = ms.ToArray();
                }

                // Convert
                byte[] jpgBytes = _conversionService.ConvertToJpg(imageBytes, quality);

                // Build output filename: original_name.png -> original_name.jpg
                string outputName = "converted.jpg";
                if (!string.IsNullOrEmpty(file.FileName))
                {
                    var nameWithoutExt = Path.GetFileNameWithoutExtension(file.FileName);
                    outputName = $"{nameWithoutExt}.jpg";
                }

                // Return as downloadable JPG.
                // File() is ASP.NET Core's equivalent of Spring's ResponseEntity
                // with content-type + content-disposition headers.
                return File(jpgBytes, "image/jpeg", outputName);

            }
            catch (Exception ex) 
            {
                return BadRequest(new
                {
                    error = "Conversion failed",
                    message = ex.Message
                });
            }
        }

        /// <summary>
        /// Get info about an uploaded image (dimensions, alpha, size).
        /// </summary>
        [HttpPost("info")]
        [RequestSizeLimit(50 * 1024 * 1024)]
        public async Task<IActionResult> GetImageInfo(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "No file provided" });

            try
            {
                byte[] imageBytes;
                using (var ms = new MemoryStream())
                {
                    await file.CopyToAsync(ms);
                    imageBytes = ms.ToArray();
                }

                ImageInfo info = _conversionService.GetImageInfo(imageBytes);
                return Ok(info);
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    error = "Could not read image",
                    message = ex.Message
                });
            }
        }
    }
}
