using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using UglyToad.PdfPig;

// usage: crop <pdf> <topPt> <bottomPt> <outDir>   (DI endpoint/key from env DI_ENDPOINT / DI_KEY)
var path = args[0];
var topPt = double.Parse(args[1], System.Globalization.CultureInfo.InvariantCulture);
var bottomPt = double.Parse(args[2], System.Globalization.CultureInfo.InvariantCulture);
var outDir = args[3];
Directory.CreateDirectory(outDir);
var bytes = File.ReadAllBytes(path);
P.FPDF_InitLibrary();
var handle = GCHandle.Alloc(bytes, GCHandleType.Pinned);
var src = P.FPDF_LoadMemDocument(handle.AddrOfPinnedObject(), bytes.Length, null);
var srcPage = P.FPDF_LoadPage(src, 0);
float W = P.FPDF_GetPageWidthF(srcPage), H = P.FPDF_GetPageHeightF(srcPage);

// 1) a one-page PDF whose MediaBox and CropBox are the section (PDF y runs bottom-up)
var dst = P.FPDF_CreateNewDocument();
P.FPDF_ImportPages(dst, src, "1", 0);
var dp = P.FPDF_LoadPage(dst, 0);
float lo = (float)(H - bottomPt), hi = (float)(H - topPt);
P.FPDFPage_SetMediaBox(dp, 0, lo, W, hi);
P.FPDFPage_SetCropBox(dp, 0, lo, W, hi);
P.FPDF_ClosePage(dp);
var saved = Save(dst);
File.WriteAllBytes(Path.Combine(outDir, "section.pdf"), saved);

// 2) the same section rendered at 150 dpi
var scale = 150.0 / 72.0;
int w = (int)Math.Round(W * scale), hh = (int)Math.Round((bottomPt - topPt) * scale);
var bmp = P.FPDFBitmap_Create(w, hh, 0);
P.FPDFBitmap_FillRect(bmp, 0, 0, w, hh, 0xFFFFFFFF);
var m = new FS_MATRIX { a = (float)scale, d = (float)scale, f = (float)(-topPt * scale) };
var clip = new FS_RECTF { right = w, bottom = hh };
P.FPDF_RenderPageBitmapWithMatrix(bmp, srcPage, ref m, ref clip, 0x201);
var stride = P.FPDFBitmap_GetStride(bmp);
var buf = new byte[w * hh * 4];
var bp = P.FPDFBitmap_GetBuffer(bmp);
for (var y = 0; y < hh; y++) Marshal.Copy(bp + y * stride, buf, y * w * 4, w * 4);
using (var img = Image.LoadPixelData<Bgra32>(buf, w, hh)) img.SaveAsPng(Path.Combine(outDir, "section.png"));
P.FPDFBitmap_Destroy(bmp);

// 3) the text layer's words inside the section (ground truth) and only outside it (leak detector)
var inside = new List<string>();
var outside = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
using (var doc = PdfDocument.Open(bytes))
{
    var page = doc.GetPage(1);
    foreach (var word in page.GetWords())
    {
        var yTop = H - word.BoundingBox.Top;
        var yBot = H - word.BoundingBox.Bottom;
        var t = word.Text.Trim();
        if (t.Length < 3) continue;
        if (yTop >= topPt && yBot <= bottomPt) inside.Add(t);
        else if (yBot < topPt - 36 || yTop > bottomPt + 36) outside.Add(t);
    }
}
foreach (var word in inside) outside.Remove(word);
File.WriteAllText(Path.Combine(outDir, "truth.txt"), string.Join(' ', inside));
Console.WriteLine($"page {W}x{H} pt; section {topPt}-{bottomPt}; truth words inside={inside.Count}, words found only outside={outside.Count}");

var endpoint = Environment.GetEnvironmentVariable("DI_ENDPOINT")!.TrimEnd('/');
var key = Environment.GetEnvironmentVariable("DI_KEY")!;
using var http = new HttpClient();
foreach (var (name, payload) in new[] { ("pdf", saved), ("png", File.ReadAllBytes(Path.Combine(outDir, "section.png"))) })
{
    var content = await Analyze(http, endpoint, key, payload);
    File.WriteAllText(Path.Combine(outDir, $"di-{name}.md"), content);
    var got = Tokens(content);
    var found = inside.Count(t => got.Contains(Norm(t)));
    var leaked = outside.Where(t => got.Contains(Norm(t))).ToList();
    Console.WriteLine($"{name}: {content.Length} chars; truth words found {found}/{inside.Count} ({100.0 * found / Math.Max(1, inside.Count):0.0}%); words from OUTSIDE present: {leaked.Count} [{string.Join(", ", leaked.Take(12))}]");
}

static string Norm(string s) => new string(s.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
static HashSet<string> Tokens(string s) => s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Select(Norm).Where(t => t.Length > 0).ToHashSet();

static async Task<string> Analyze(HttpClient http, string endpoint, string key, byte[] payload)
{
    var url = $"{endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30&outputContentFormat=markdown";
    using var req = new HttpRequestMessage(HttpMethod.Post, url)
    {
        Content = new StringContent(JsonSerializer.Serialize(new { base64Source = Convert.ToBase64String(payload) }), Encoding.UTF8, "application/json")
    };
    req.Headers.Add("Ocp-Apim-Subscription-Key", key);
    using var resp = await http.SendAsync(req);
    if (!resp.IsSuccessStatusCode) return $"ERROR {(int)resp.StatusCode} {await resp.Content.ReadAsStringAsync()}";
    var operation = resp.Headers.GetValues("Operation-Location").First();
    while (true)
    {
        await Task.Delay(1500);
        using var poll = new HttpRequestMessage(HttpMethod.Get, operation);
        poll.Headers.Add("Ocp-Apim-Subscription-Key", key);
        using var r = await http.SendAsync(poll);
        var json = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        var status = json.RootElement.GetProperty("status").GetString();
        if (status == "succeeded") return json.RootElement.GetProperty("analyzeResult").GetProperty("content").GetString() ?? "";
        if (status == "failed") return "FAILED " + json.RootElement;
    }
}

static byte[] Save(IntPtr doc)
{
    var ms = new MemoryStream();
    P.WriteBlockFn callback = (self, data, size) =>
    {
        var chunk = new byte[size];
        Marshal.Copy(data, chunk, 0, (int)size);
        ms.Write(chunk);
        return 1;
    };
    var writer = new FPDF_FILEWRITE { version = 1, WriteBlock = Marshal.GetFunctionPointerForDelegate(callback) };
    P.FPDF_SaveAsCopy(doc, ref writer, 0);
    GC.KeepAlive(callback);
    return ms.ToArray();
}

[StructLayout(LayoutKind.Sequential)] struct FS_MATRIX { public float a, b, c, d, e, f; }
[StructLayout(LayoutKind.Sequential)] struct FS_RECTF { public float left, top, right, bottom; }
[StructLayout(LayoutKind.Sequential)] struct FPDF_FILEWRITE { public int version; public IntPtr WriteBlock; }

static class P
{
    const string L = "pdfium";
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] public delegate int WriteBlockFn(IntPtr self, IntPtr data, uint size);
    [DllImport(L)] public static extern void FPDF_InitLibrary();
    [DllImport(L)] public static extern IntPtr FPDF_LoadMemDocument(IntPtr data, int size, string? password);
    [DllImport(L)] public static extern IntPtr FPDF_CreateNewDocument();
    [DllImport(L)] public static extern int FPDF_ImportPages(IntPtr dest, IntPtr src, string range, int index);
    [DllImport(L)] public static extern int FPDF_SaveAsCopy(IntPtr doc, ref FPDF_FILEWRITE writer, uint flags);
    [DllImport(L)] public static extern IntPtr FPDF_LoadPage(IntPtr doc, int index);
    [DllImport(L)] public static extern void FPDF_ClosePage(IntPtr page);
    [DllImport(L)] public static extern float FPDF_GetPageWidthF(IntPtr page);
    [DllImport(L)] public static extern float FPDF_GetPageHeightF(IntPtr page);
    [DllImport(L)] public static extern void FPDFPage_SetMediaBox(IntPtr page, float l, float b, float r, float t);
    [DllImport(L)] public static extern void FPDFPage_SetCropBox(IntPtr page, float l, float b, float r, float t);
    [DllImport(L)] public static extern IntPtr FPDFBitmap_Create(int w, int h, int alpha);
    [DllImport(L)] public static extern void FPDFBitmap_FillRect(IntPtr bmp, int l, int t, int w, int h, uint color);
    [DllImport(L)] public static extern void FPDF_RenderPageBitmapWithMatrix(IntPtr bmp, IntPtr page, ref FS_MATRIX m, ref FS_RECTF clip, int flags);
    [DllImport(L)] public static extern IntPtr FPDFBitmap_GetBuffer(IntPtr bmp);
    [DllImport(L)] public static extern int FPDFBitmap_GetStride(IntPtr bmp);
    [DllImport(L)] public static extern void FPDFBitmap_Destroy(IntPtr bmp);
}
