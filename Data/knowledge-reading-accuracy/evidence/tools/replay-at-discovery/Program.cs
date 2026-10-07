using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using Clinqet.Core.Interfaces.AI;
using Clinqet.Infrastructure.Services.AI;
using Clinqet.Infrastructure.Services.Knowledge;
using Clinqet.Shared.Models;
using Microsoft.Extensions.Options;

// replay <diBank.json> <ocrDir with pNNN.json> <outPrefix> [fixClose]
// Re-runs the production path: Attach -> Split -> CarryFigures(read pages) -> Join -> ParseLayoutMarkdown.
var (diPath, ocrDir, outPrefix) = (args[0], args[1], args[2]);
var opts = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull, Converters = { new JsonStringEnumConverter() } };
var root = JsonDocument.Parse(File.ReadAllText(diPath)).RootElement;
var result = root.GetProperty("result").Deserialize<DocumentRawExtractionResult>(opts)!;
var ocrMarkdown = LayoutFigureCaptions.Attach(result, CancellationToken.None);
var pages = PageMarkdownSplicer.Split(ocrMarkdown);
var read = 0;
for (var i = 0; i < pages.Count; i++)
{
    var f = Path.Combine(ocrDir, $"p{i + 1:000}.json");
    if (!File.Exists(f)) continue;
    var md = JsonDocument.Parse(File.ReadAllText(f)).RootElement.GetProperty("markdown").GetString() ?? "";
    if (md.Length == 0) continue;
    pages[i] = PageMarkdownSplicer.CarryFigures(pages[i], md);
    read++;
}
var joined = PageMarkdownSplicer.Join(pages);
if (args.Length > 3 && args[3] == "fixClose") joined = Counter.TagsOnOwnLines(joined);
File.WriteAllText(outPrefix + ".joined.md", joined);
var strip = typeof(KnowledgeDocumentParser).GetMethod("StripRepeatedPageLines", BindingFlags.NonPublic | BindingFlags.Static)!;
File.WriteAllText(outPrefix + ".afterFurniture.md", (string)strip.Invoke(null, [joined])!);
var parser = new KnowledgeDocumentParser(Options.Create(new VoiceKnowledgeSettings()));
var output = parser.ParseLayoutMarkdown(joined, collectImages: true);
Console.WriteLine($"pages={pages.Count} transcriptsUsed={read} joinedChars={joined.Length} blocks={output.Blocks.Count}");
var i2 = 0;
foreach (var b in output.Blocks)
{
    var text = b.Text ?? (b.Table != null ? "[TABLE rows=" + b.Table.Rows.Count + "] " + string.Join(" | ", b.Table.Rows.FirstOrDefault() ?? []) : "");
    Console.WriteLine($"[{i2++,2}] {b.Kind,-12} p{b.PageNumber} furn={b.IsPageFurniture} img={b.ImageIndex} len={text.Length} :: {text.Replace("\n", " / ")[..Math.Min(150, text.Length)]}");
}
var money = System.Text.RegularExpressions.Regex.Matches(joined, @"\$[0-9][0-9,]*(\.[0-9]+)?").Select(m => m.Value).ToList();
var kept = string.Join("\n", output.Blocks.Select(b => (b.Text ?? "") + (b.Table != null ? string.Join("\n", b.Table.Rows.Select(r => string.Join(" ", r))) : "")));
var lost = money.Where(m => !kept.Contains(m)).ToList();
Console.WriteLine($"money tokens in page readings: {money.Count}; missing from parsed blocks: {lost.Count} -> {string.Join(", ", lost.Distinct().Take(40))}");
