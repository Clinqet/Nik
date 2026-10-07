using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Clinqet.Core.Interfaces.AI;
using Clinqet.Core.Models.Knowledge;
using Clinqet.Infrastructure.Services.AI;
using Clinqet.Infrastructure.Services.Knowledge;
using Clinqet.Shared.Enums;
using Clinqet.Shared.Models;
using Microsoft.Extensions.Options;

// replay <diBank.json> <ocrDir with pNNN.json> <outPrefix>
// Re-runs the production path: Attach -> Split -> CarryFigures(read pages) -> Join -> ParseLayoutMarkdown -> Chunk.
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
File.WriteAllText(outPrefix + ".joined.md", joined);
var parser = new KnowledgeDocumentParser(Options.Create(new VoiceKnowledgeSettings()));
var output = parser.ParseLayoutMarkdown(joined, collectImages: true);
Console.WriteLine($"pages={pages.Count} transcriptsUsed={read} joinedChars={joined.Length} blocks={output.Blocks.Count} pageCount={output.PageCount}");
var c = output.Conservation;
Console.WriteLine(c == null
    ? "conservation: nothing lost"
    : $"conservation: LOST {c.LostCount} (numbers={c.LostNumbers}) sample=[{string.Join(", ", c.LostSample)}] pagesAsText=[{string.Join(",", c.PagesKeptAsText)}] stillLost={c.StillLostCount} [{string.Join(", ", c.StillLostSample)}]");
using (var w = new StreamWriter(outPrefix + ".blocks.txt"))
{
    var i2 = 0;
    foreach (var b in output.Blocks)
    {
        var text = b.Kind == KnowledgeBlockKind.Table && b.Table != null
            ? $"[TABLE header={b.Table.HasHeaderRow} caption={b.Table.Caption}]\n" + string.Join("\n", b.Table.Rows.Select(r => "  | " + string.Join(" | ", r)))
            : b.Kind == KnowledgeBlockKind.List ? $"[LIST intro={b.ListIntro}]\n" + string.Join("\n", b.ListItems.Select(x => "  - " + x)) : b.Text;
        w.WriteLine($"[{i2++,3}] {b.Kind} p{b.PageNumber} furn={b.IsPageFurniture} img={b.ImageIndex} nb={b.ImageNeighbourText?.Replace("\n", " / ")}\n{text}\n");
    }
}

var chunker = new KnowledgeChunker();
var chunks = chunker.Chunk(output.Blocks,
    new KnowledgeChunkContext { DocTitle = Path.GetFileName(outPrefix), DocType = KnowledgeDocType.Other },
    new KnowledgeChunkerOptions { TargetTokens = 350, MaxTokens = 512, MinTokens = 120, OverlapPercent = 15 }).Chunks;
File.WriteAllText(outPrefix + ".cards.txt", string.Join("\n\n----\n", chunks.Select(ch => $"[{ch.Kind}] p{ch.PageNumber} § {ch.SectionPath}\n{ch.Content}")));

static List<string> Amounts(string text) => Regex.Matches(text, @"[$₹]\s?[0-9][0-9,]*(\.[0-9]+)?").Select(m => Regex.Replace(m.Value, @"\s", "")).ToList();
static List<string> Short(List<string> want, List<string> have)
{
    var pool = have.GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count());
    var missing = new List<string>();
    foreach (var x in want) { if (pool.GetValueOrDefault(x) > 0) pool[x]--; else missing.Add(x); }
    return missing;
}
var inReadings = Amounts(joined);
var blockText = string.Join("\n", output.Blocks.SelectMany(b => new[] { b.Text, b.ListIntro ?? "", b.Table?.Caption ?? "" }
    .Concat(b.ListItems).Concat(b.Table?.Rows.SelectMany(r => r) ?? [])));
var inBlocks = Amounts(blockText);
var inCards = Amounts(string.Join("\n", chunks.Select(ch => ch.Content)));
var lostToBlocks = Short(inReadings, inBlocks);
var lostToCards = Short(inReadings.Distinct().ToList(), inCards);
Console.WriteLine($"amounts in page readings: {inReadings.Count} ({inReadings.Distinct().Count()} distinct); missing from blocks (counted): {lostToBlocks.Count} -> {string.Join(", ", lostToBlocks.Take(40))}");
Console.WriteLine($"cards: {chunks.Count}; distinct amounts missing from cards: {lostToCards.Count} -> {string.Join(", ", lostToCards.Take(40))}");
