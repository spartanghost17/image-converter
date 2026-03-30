using image_converter.Services;

var builder = WebApplication.CreateBuilder(args);

// --- Register services ---
builder.Services.AddControllers();  // auto-discovers all controllers
builder.Services.AddSingleton<ImageConversionService>();  // our conversion service
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS: allow React dev server to call this API
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactDev", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://127.0.0.1:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Increase upload limit to 50MB (default is ~28MB)
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 50 * 1024 * 1024;
});

var app = builder.Build();

// --- Middleware pipeline ---
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("ReactDev");
app.UseAuthorization();
app.MapControllers();

app.Run();