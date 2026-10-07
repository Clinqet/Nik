using System.Diagnostics;
using System.IO.Compression;
using System.Text.Json;
using System.Text.Json.Serialization;
using Clinqet.Core.Interfaces.AI;
using Clinqet.Core.Models.Knowledge;
using Clinqet.Infrastructure.Services.AI;
using Clinqet.Infrastructure.Services.Knowledge;
using Clinqet.Shared.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using SixLabors.ImageSharp.Processing;

// usage: Harness <pdf> <di.json.gz> <appsettings.json> [copies=1] [steps=all]
var pdfPath = args[0];
var diPath = args[1];
var settingsPath = args[2];
var copies = args.Length > 3 ? int.Parse(args[3]) : 1;
var only = args.Length > 4 ? args[4] : "all";

var config = new ConfigurationBuilder().AddJsonFile(settingsPath).Build();
var knowledge = config.GetSection("Voice:Knowledge").Get<VoiceKnowledgeSettings>() ?? new VoiceKnowledgeSettings();
var remote = config.GetSection("RemoteImageIngestion").Get<RemoteImageIngestionSettings>() ?? new RemoteImageIngestionSettings();
Console.WriteLine($"GC server={System.Runtime.GCSettings.IsServerGC} heapHardLimit={GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 1048576} MB  cpus={Environment.ProcessorCount}  os={System.Runtime.InteropServices.RuntimeInformation.OSDescription}");
Console.WriteLine($"render={knowledge.Vision.PageRenderMaxEdgePixels} verify={knowledge.Vision.VerifyPageRenderMaxEdgePixels} maxDecoded={remote.MaxDecodedPixels} stored={knowledge.Images.MaxStoredEdgePixels} caption={knowledge.Images.CaptionDownscaleMaxPixels} q={knowledge.Images.NormalizedJpegQuality}");

var sampler = new Sampler();
sampler.Start();

var tasks = Enumerable.Range(0, copies).Select(i => Task.Run(() => RunOnce(i))).ToArray();
await Task.WhenAll(tasks);
sampler.Mark("ALL DONE");
GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
sampler.Mark("after full GC");
sampler.Stop();
Console.WriteLine($"PROCESS PEAK working set {Process.GetCurrentProcess().PeakWorkingSet64 / 1048576} MB, sampled peak private {sampler.PeakPrivate / 1048576} MB, sampled peak managed heap {sampler.PeakHeap / 1048576} MB");

async Task RunOnce(int copy)
{
    var tag = $"[{copy}]";
    var bytes = await File.ReadAllBytesAsync(pdfPath);
    sampler.Mark($"{tag} S1 pdf bytes {bytes.Length}");

    DocumentRawExtractionResult ocr;
    await using (var fs = File.OpenRead(diPath))
    await using (var gz = new GZipStream(fs, CompressionMode.Decompress))
    {
        var entry = await JsonSerializer.DeserializeAsync<JsonElement>(gz);
        ocr = entry.GetProperty("result").Deserialize<DocumentRawExtractionResult>(new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        })!;
    }
    sampler.Mark($"{tag} S2 banked DI ({ocr.Figures.Count} figures, {ocr.Content.Length} chars)");

    var markdown = LayoutFigureCaptions.Attach(ocr, CancellationToken.None);
    sampler.Mark($"{tag} S3 layout captions ({markdown.Length} chars)");

    var rasterizer = new DocumentPageRasterizer(NullLogger<DocumentPageRasterizer>.Instance);
    if (only is "all" or "render")
    {
        var sw = Stopwatch.StartNew();
        var raster = await rasterizer.RasterizeAsync(bytes, ".pdf", knowledge.Vision.PageRenderMaxEdgePixels,
            remote.MaxDecodedPixels, knowledge.Images.NormalizedJpegQuality, knowledge.MaxPagesPerDocument);
        sampler.Mark($"{tag} S4 rasterize@{knowledge.Vision.PageRenderMaxEdgePixels}: {raster.Pages.Count} page(s) {string.Join(",", raster.Pages.Select(p => $"{p.Width}x{p.Height} jpeg={p.Jpeg.Length} layer={p.TextLayer?.Length}"))} in {sw.ElapsedMilliseconds} ms");
        sw.Restart();
        var verifyPage = await rasterizer.RasterizePageAsync(bytes, ".pdf", 1, knowledge.Vision.VerifyPageRenderMaxEdgePixels,
            remote.MaxDecodedPixels, knowledge.Images.NormalizedJpegQuality);
        sampler.Mark($"{tag} S5 rasterize page 1 @{knowledge.Vision.VerifyPageRenderMaxEdgePixels}: {verifyPage?.Width}x{verifyPage?.Height} jpeg={verifyPage?.Jpeg.Length} in {sw.ElapsedMilliseconds} ms");
    }

    var parser = new KnowledgeDocumentParser(Options.Create(knowledge));
    var output = parser.ParseLayoutMarkdown(markdown, collectImages: true);
    sampler.Mark($"{tag} S6 parse ({output.Blocks.Count} blocks)");

    if (only is "all" or "bind")
    {
        var di = new Mock<IDocumentIntelligenceService>();
        di.Setup(d => d.GetAnalyzeFigureAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
          .ReturnsAsync((byte[]?)null);
        var extractor = new KnowledgeImageExtractor(di.Object, Options.Create(knowledge), Options.Create(remote), NullLogger<KnowledgeImageExtractor>.Instance);
        var sw = Stopwatch.StartNew();
        var bound = await extractor.BindPdfImagesAsync(bytes, ocr, output.Blocks);
        var totalBytes = bound.Images.Sum(i => (long)i.Bytes.Length);
        sampler.Mark($"{tag} S7 bind: {bound.Images.Count} images, {totalBytes / 1024} KB of source bytes, noPixels={bound.FiguresWithNoPixels} undecodable={bound.UndecodableNativeRasters} wholePage={bound.FilteredWholePageFigures} in {sw.ElapsedMilliseconds} ms");

        sw.Restart();
        var kept = 0;
        foreach (var image in bound.Images)
        {
            var size = await KnowledgeImageNormalizer.TryIdentifyAsync(image.Bytes, CancellationToken.None);
            if (size == null) continue;
            var normalized = await KnowledgeImageNormalizer.NormalizeAsync(image.Bytes, knowledge.Images.MaxStoredEdgePixels,
                remote.MaxDecodedPixels, CancellationToken.None, knowledge.Images.NormalizedJpegQuality);
            if (normalized == null) continue;
            using (var loaded = SixLabors.ImageSharp.Image.Load(normalized.Bytes))
            {
                loaded.Mutate(x => x.Resize(new SixLabors.ImageSharp.Processing.ResizeOptions
                {
                    Mode = SixLabors.ImageSharp.Processing.ResizeMode.Max,
                    Size = new SixLabors.ImageSharp.Size(knowledge.Images.CaptionDownscaleMaxPixels, knowledge.Images.CaptionDownscaleMaxPixels)
                }));
            }
            kept++;
        }
        sampler.Mark($"{tag} S8 picture lane (identify+normalize+caption downscale) {kept} kept in {sw.ElapsedMilliseconds} ms");
        GC.KeepAlive(bound);
    }
    GC.KeepAlive(bytes);
}

sealed class Sampler
{
    private readonly Process _process = Process.GetCurrentProcess();
    private long _peakWs, _peakPrivate, _peakHeap, _windowWs, _windowPrivate, _windowHeap;
    private readonly object _gate = new();
    private Thread? _thread;
    private volatile bool _run;
    private readonly Stopwatch _clock = Stopwatch.StartNew();
    public long PeakPrivate => _peakPrivate;
    public long PeakHeap => _peakHeap;

    public void Start()
    {
        _run = true;
        _thread = new Thread(() =>
        {
            while (_run)
            {
                Sample();
                Thread.Sleep(20);
            }
        }) { IsBackground = true };
        _thread.Start();
        Mark("baseline");
    }

    private void Sample()
    {
        _process.Refresh();
        var ws = _process.WorkingSet64;
        var priv = _process.PrivateMemorySize64;
        var heap = GC.GetTotalMemory(false);
        lock (_gate)
        {
            _windowWs = Math.Max(_windowWs, ws); _windowPrivate = Math.Max(_windowPrivate, priv); _windowHeap = Math.Max(_windowHeap, heap);
            _peakWs = Math.Max(_peakWs, ws); _peakPrivate = Math.Max(_peakPrivate, priv); _peakHeap = Math.Max(_peakHeap, heap);
        }
    }

    public void Mark(string step)
    {
        Sample();
        lock (_gate)
        {
            _process.Refresh();
            Console.WriteLine($"{_clock.Elapsed.TotalSeconds,7:0.00}s  {step,-110} now ws={_process.WorkingSet64 / 1048576,5} MB priv={_process.PrivateMemorySize64 / 1048576,5} MB heap={GC.GetTotalMemory(false) / 1048576,5} MB | window peak ws={_windowWs / 1048576,5} priv={_windowPrivate / 1048576,5} heap={_windowHeap / 1048576,5}");
            _windowWs = _windowPrivate = _windowHeap = 0;
        }
    }

    public void Stop() { _run = false; _thread?.Join(); }
}
