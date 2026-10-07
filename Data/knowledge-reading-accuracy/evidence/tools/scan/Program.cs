using System.IO.Compression;
using System.Text.RegularExpressions;
using Azure.Storage.Blobs;
using Microsoft.Azure.Cosmos;
using Newtonsoft.Json.Linq;
// scan <ca|in> — read-only blast-radius scan: for every Ready knowledge document, compare the money/number tokens in its
// banked page readings (vision page cache) with the saved reading's blocks. Scratch tool, sandbox only.
var region = args[0];
var cfg = JObject.Parse(File.ReadAllText(region == "in" ? @"C:\Nik\cosmosindexsetup\appsettings.in.json" : @"C:\Nik\cosmosindexsetup\appsettings.ca.json"));
using var cosmos = new CosmosClient((string)cfg["CosmosDb"]!["ConnectionString"]!, new CosmosClientOptions { ConnectionMode = ConnectionMode.Gateway });
var db = (string?)cfg["CosmosDb"]!["DatabaseName"] ?? "Clinket-nonprod";
var kb = cosmos.GetContainer(db, "KnowledgeBase-dev");
var blobs = new BlobContainerClient((string)cfg["AzureStorage"]!["ConnectionString"]!, "provider-knowledge");
var rows = new List<JObject>();
using (var it = kb.GetItemQueryIterator<JObject>("SELECT c.businessId, c.docId, c.docName, c.status, c.contentHash, c.pageCount, c.passageCount FROM c WHERE c.type = 'KnowledgeDocument'"))
    while (it.HasMoreResults) rows.AddRange(await it.ReadNextAsync());
Console.WriteLine($"{region}: {rows.Count} knowledge rows (db {db})");
var money = new Regex(@"\$\s?[0-9][0-9,]*(\.[0-9]+)?|[0-9]{1,3}(,[0-9]{3})+(\.[0-9]+)?|[0-9]+\.[0-9]{2}\b");
int scanned = 0, withPages = 0, losing = 0;
foreach (var r in rows.Where(x => (string?)x["status"] == "Ready" && !string.IsNullOrEmpty((string?)x["contentHash"])))
{
    var (biz, doc, hash, name) = ((string)r["businessId"]!, (string)r["docId"]!, (string)r["contentHash"]!, (string?)r["docName"]);
    scanned++;
    string artifactText;
    try
    {
        var ms = new MemoryStream(); await blobs.GetBlobClient($"{biz}/_artifacts/{doc}/{hash}.json.gz").DownloadToAsync(ms); ms.Position = 0;
        using var gz = new GZipStream(ms, CompressionMode.Decompress); using var sr = new StreamReader(gz);
        var art = JObject.Parse(await sr.ReadToEndAsync());
        artifactText = string.Join("\n", ((JArray?)art["blocks"] ?? []).Select(b => ((string?)b["text"] ?? "") + " "
            + string.Join(" ", ((JArray?)b["listItems"] ?? []).Select(x => x.ToString())) + " " + (b["table"]?.ToString() ?? "")));
    }
    catch { Console.WriteLine($"  [no artifact] {biz}/{doc} {name}"); continue; }
    var pageTexts = new List<(string Page, string Md)>();
    await foreach (var b in blobs.GetBlobsAsync(prefix: $"_ocr/{biz}/{doc}/{hash}/"))
    {
        if (!b.Name.EndsWith(".json") || !Regex.IsMatch(Path.GetFileName(b.Name), @"^p\d{3}\.json$")) continue;
        var ms = new MemoryStream(); await blobs.GetBlobClient(b.Name).DownloadToAsync(ms);
        var md = (string?)JObject.Parse(System.Text.Encoding.UTF8.GetString(ms.ToArray()))["markdown"] ?? "";
        pageTexts.Add((Path.GetFileNameWithoutExtension(b.Name), md));
    }
    if (pageTexts.Count == 0) continue;
    withPages++;
    var normalizedSaved = Regex.Replace(artifactText, @"\s+", " ");
    var lostByPage = new List<string>(); int total = 0, lost = 0;
    foreach (var (page, md) in pageTexts.OrderBy(p => p.Page))
    {
        var tokens = money.Matches(md).Select(m => m.Value.Replace(" ", "")).Distinct().ToList();
        var missing = tokens.Where(t => !normalizedSaved.Contains(t)).ToList();
        total += tokens.Count; lost += missing.Count;
        if (missing.Count > 0) lostByPage.Add($"{page}:{missing.Count}/{tokens.Count}");
    }
    if (lost > 0) losing++;
    Console.WriteLine($"  {(lost > 0 ? "LOSS" : "ok  ")} {biz}/{doc} pages-read={pageTexts.Count} numbers={total} missing={lost} {string.Join(" ", lostByPage)} :: {name}");
}
Console.WriteLine($"{region}: Ready rows scanned={scanned}, with banked page readings={withPages}, documents losing numbers={losing}");
