using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;

// usage: clip <pdf> <mode: full|sections|both> <pxPerPt> <sectionHeightPt> <flags>
var bytes = File.ReadAllBytes(args[0]);
var mode = args[1];
var scale = double.Parse(args[2], System.Globalization.CultureInfo.InvariantCulture);
var sectionPt = double.Parse(args[3], System.Globalization.CultureInfo.InvariantCulture);
var flags = int.Parse(args[4]);
var proc = Process.GetCurrentProcess();
long peak = 0; var run = true;
var sampler = new Thread(() => { while (run) { proc.Refresh(); peak = Math.Max(peak, proc.PrivateMemorySize64); Thread.Sleep(5); } }) { IsBackground = true }; sampler.Start();

P.FPDF_InitLibrary();
var handle = GCHandle.Alloc(bytes, GCHandleType.Pinned);
var doc = P.FPDF_LoadMemDocument(handle.AddrOfPinnedObject(), bytes.Length, null);
var page = P.FPDF_LoadPage(doc, 0);
var wPt = P.FPDF_GetPageWidthF(page); var hPt = P.FPDF_GetPageHeightF(page);
Console.WriteLine($"page {wPt:0}x{hPt:0} pt, scale {scale} px/pt, flags {flags}");
proc.Refresh(); var baseline = proc.PrivateMemorySize64;

byte[]? full = null; int fullW = 0, fullH = 0;
if (mode is "full" or "both")
{
    peak = 0; var sw = Stopwatch.StartNew();
    (full, fullW, fullH) = Render(page, wPt, hPt, 0, hPt, scale, flags);
    Console.WriteLine($"FULL {fullW}x{fullH} ({full.Length / 1048576.0:0.0} MB) in {sw.ElapsedMilliseconds} ms, peak Δ {(peak - baseline) / 1048576} MB");
}
if (mode is "sections" or "both")
{
    var n = (int)Math.Ceiling(hPt / sectionPt); long worst = 0; var mismatches = 0; var sw = Stopwatch.StartNew();
    for (var k = 0; k < n; k++)
    {
        peak = 0; proc.Refresh(); var before = proc.PrivateMemorySize64;
        var top = k * sectionPt; var bottom = Math.Min(hPt, top + sectionPt);
        var (buf, w, h) = Render(page, wPt, hPt, top, bottom, scale, flags);
        var delta = peak - before; worst = Math.Max(worst, delta);
        if (full != null)
        {
            // compare against the same rows of the full render
            var y0 = (int)Math.Round(top * scale); var stride = w * 4; var same = true;
            for (var y = 0; y < h && y0 + y < fullH && same; y++)
                same = full.AsSpan((y0 + y) * fullW * 4, stride).SequenceEqual(buf.AsSpan(y * stride, stride));
            if (!same) mismatches++;
        }
        Console.WriteLine($"  section {k + 1}/{n} y={top:0}-{bottom:0}pt -> {w}x{h} peak Δ {delta / 1048576} MB sha {Convert.ToHexString(SHA256.HashData(buf))[..8]}");
    }
    Console.WriteLine($"SECTIONS {n} in {sw.ElapsedMilliseconds} ms, worst peak Δ {worst / 1048576} MB{(full != null ? $", sections differing from the full render: {mismatches}" : "")}");
}
P.FPDF_ClosePage(page); P.FPDF_CloseDocument(doc); handle.Free(); P.FPDF_DestroyLibrary();
run = false;

static (byte[] Buffer, int W, int H) Render(IntPtr page, float wPt, float hPt, double topPt, double bottomPt, double scale, int flags)
{
    var w = (int)Math.Round(wPt * scale);
    var h = (int)Math.Round((bottomPt - topPt) * scale);
    var bmp = P.FPDFBitmap_Create(w, h, 0);
    P.FPDFBitmap_FillRect(bmp, 0, 0, w, h, 0xFFFFFFFF);
    // device = page * scale, shifted up by the section top; clip = the bitmap
    var m = new FS_MATRIX { a = (float)scale, b = 0, c = 0, d = (float)scale, e = 0, f = (float)(-topPt * scale) };
    var clip = new FS_RECTF { left = 0, top = 0, right = w, bottom = h };
    P.FPDF_RenderPageBitmapWithMatrix(bmp, page, ref m, ref clip, flags);
    var stride = P.FPDFBitmap_GetStride(bmp);
    var buf = new byte[w * h * 4];
    var src = P.FPDFBitmap_GetBuffer(bmp);
    for (var y = 0; y < h; y++) Marshal.Copy(src + y * stride, buf, y * w * 4, w * 4);
    P.FPDFBitmap_Destroy(bmp);
    return (buf, w, h);
}

[StructLayout(LayoutKind.Sequential)] struct FS_MATRIX { public float a, b, c, d, e, f; }
[StructLayout(LayoutKind.Sequential)] struct FS_RECTF { public float left, top, right, bottom; }
static class P
{
    const string L = "pdfium";
    [DllImport(L)] public static extern void FPDF_InitLibrary();
    [DllImport(L)] public static extern void FPDF_DestroyLibrary();
    [DllImport(L)] public static extern IntPtr FPDF_LoadMemDocument(IntPtr data, int size, string? password);
    [DllImport(L)] public static extern void FPDF_CloseDocument(IntPtr doc);
    [DllImport(L)] public static extern IntPtr FPDF_LoadPage(IntPtr doc, int index);
    [DllImport(L)] public static extern void FPDF_ClosePage(IntPtr page);
    [DllImport(L)] public static extern float FPDF_GetPageWidthF(IntPtr page);
    [DllImport(L)] public static extern float FPDF_GetPageHeightF(IntPtr page);
    [DllImport(L)] public static extern IntPtr FPDFBitmap_Create(int w, int h, int alpha);
    [DllImport(L)] public static extern void FPDFBitmap_FillRect(IntPtr bmp, int l, int t, int w, int h, uint color);
    [DllImport(L)] public static extern void FPDF_RenderPageBitmapWithMatrix(IntPtr bmp, IntPtr page, ref FS_MATRIX m, ref FS_RECTF clip, int flags);
    [DllImport(L)] public static extern IntPtr FPDFBitmap_GetBuffer(IntPtr bmp);
    [DllImport(L)] public static extern int FPDFBitmap_GetStride(IntPtr bmp);
    [DllImport(L)] public static extern void FPDFBitmap_Destroy(IntPtr bmp);
}
