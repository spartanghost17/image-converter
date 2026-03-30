# Image to JPG Converter

A full-stack app that converts any image format to JPG. Built with ASP.NET Core (C#) and React.

Converts PNG, WebP, TIFF, BMP, GIF → JPG with adjustable quality.

## How it works

Your image goes through the JPEG compression pipeline — all handled internally by the ImageSharp library:

1. **Decode** the source format into raw pixels
2. **RGB → YCbCr** — separate brightness from color (human eyes are more sensitive to brightness)
3. **Chroma subsampling** — reduce color channel resolution (eyes won't notice)
4. **DCT** — transform each 8×8 pixel block from spatial data to frequency data
5. **Quantization** — divide and round frequency coefficients (the lossy step — controlled by the quality slider)
6. **Huffman coding** — losslessly compress the result

Images with transparency (PNG, WebP) are composited onto a white background before encoding, since JPG doesn't support alpha channels.

## Project structure

```
image-converter/              ← ASP.NET Core backend (C#)
├── Controllers/
│   └── ImageConverterController.cs
├── Services/
│   └── ImageConversionService.cs
├── Models/
│   └── ImageInfo.cs
├── Program.cs
├── appsettings.json
└── image-converter.csproj

image-converter-frontend/     ← React frontend
├── src/
│   ├── ImageConverter.jsx
│   └── App.js
└── package.json
```

## Setup

### Backend

Requires .NET 8 SDK.

```bash
cd image-converter
dotnet restore
dotnet run
```

Runs on `http://localhost:8080`.

### Frontend

Requires Node.js.

```bash
cd image-converter-frontend
npm install
npm start
```

Runs on `http://localhost:3000`.

## API

**POST /api/convert**

- Body: `multipart/form-data` with `file` (image) and `quality` (float, 0.0–1.0, default 0.85)
- Returns: JPG file download

**POST /api/info**

- Body: `multipart/form-data` with `file` (image)
- Returns: `{ width, height, hasAlpha, channels, originalSize }`

### Test with curl

```bash
curl -X POST http://localhost:8080/api/convert \
  -F "file=@photo.png" \
  -F "quality=0.8" \
  --output photo.jpg
```

## Tech stack

- **Backend:** ASP.NET Core 8, SixLabors.ImageSharp
- **Frontend:** React
- **Supported formats:** PNG, WebP, TIFF, BMP, GIF, TGA, PBM
