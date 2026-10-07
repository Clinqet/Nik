using System.Security.Cryptography;
using UglyToad.PdfPig;

// usage: scan <folder> pages     one row per page: size, rotation, letters, pictures, decoded MB, scale vs A4, over 17 in
//        scan <folder> pictures  one row per PDF: placements, distinct stored pictures, pictures past the decorative floor
var folder = args[0];
var mode = args.Length > 1 ? args[1] : "pages";

if (mode == "pages")
    Console.WriteLine("file\tpages\tpage\twIn\thIn\trot\tletters\timages\tdecodedMB\tmaxMP\tscaleVsA4\toverDI");

foreach (var path in Directory.GetFiles(folder, "*.pdf").OrderBy(p => p))
{
    var name = Path.GetFileName(path).Split("__").Last();
    try
    {
        using var doc = PdfDocument.Open(path);
        if (mode == "pages")
        {
            for (var n = 1; n <= doc.NumberOfPages; n++)
            {
                var page = doc.GetPage(n);
                var w = page.Width;
                var h = page.Height;
                long decoded = 0;
                double maxMp = 0;
                var images = 0;
                foreach (var img in page.GetImages())
                {
                    images++;
                    var px = (long)img.WidthInSamples * img.HeightInSamples;
                    decoded += px * 4;
                    maxMp = Math.Max(maxMp, px / 1e6);
                }
                var scaleVsA4 = (1024.0 / Math.Max(w, h)) / (1024.0 / 842.0);
                var overDi = w > 17 * 72 + 0.5 || h > 17 * 72 + 0.5;
                Console.WriteLine($"{name[..Math.Min(48, name.Length)]}\t{doc.NumberOfPages}\t{n}\t{w / 72:0.0}\t{h / 72:0.0}\t{page.Rotation.Value}\t{page.Letters.Count}\t{images}\t{decoded / 1048576.0:0}\t{maxMp:0.0}\t{scaleVsA4:0.00}\t{(overDi ? "YES" : "")}");
            }
        }
        else
        {
            var distinct = new Dictionary<string, (int W, int H)>();
            var placements = 0;
            for (var n = 1; n <= doc.NumberOfPages; n++)
                foreach (var img in doc.GetPage(n).GetImages())
                {
                    placements++;
                    var raw = img.RawBytes;
                    var key = raw.Count > 0 ? Convert.ToHexString(SHA256.HashData(raw.ToArray()))[..16] : $"empty{placements}";
                    distinct.TryAdd(key, (img.WidthInSamples, img.HeightInSamples));
                }
            // the lane's decorative floor at the time of writing: short edge >= 96, area >= 200*200, aspect <= 16
            var worth = distinct.Values.Count(s => Math.Min(s.W, s.H) >= 96 && (long)s.W * s.H >= 200L * 200
                                                   && Math.Max(s.W, s.H) / (double)Math.Max(1, Math.Min(s.W, s.H)) <= 16);
            Console.WriteLine($"{name[..Math.Min(52, name.Length)],-52} pages={doc.NumberOfPages,3} placements={placements,4} distinct={distinct.Count,4} pastFloor={worth,4}");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"{name}\tERROR {ex.GetType().Name}: {ex.Message}");
    }
}
