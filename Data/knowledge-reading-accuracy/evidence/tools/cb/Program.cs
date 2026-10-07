using System.IO.Compression;
using Azure.Storage.Blobs;
using Newtonsoft.Json.Linq;
// cb ls <prefix> | cb get <blob> <outFile> [gunzip]   (scratch tool, CA sandbox, provider-knowledge container)
var cfg = JObject.Parse(File.ReadAllText(Environment.GetEnvironmentVariable("REGION") == "in"
    ? @"C:\Nik\cosmosindexsetup\appsettings.in.json" : @"C:\Nik\cosmosindexsetup\appsettings.ca.json"));
var c = new BlobContainerClient((string)cfg["AzureStorage"]!["ConnectionString"]!, "provider-knowledge");
if (args[0] == "ls")
{
    await foreach (var b in c.GetBlobsAsync(prefix: args[1]))
        Console.WriteLine($"{b.Properties.LastModified:u} {b.Properties.ContentLength,9} {b.Name}");
}
else if (args[0] == "get")
{
    var ms = new MemoryStream();
    await c.GetBlobClient(args[1]).DownloadToAsync(ms);
    ms.Position = 0;
    if (args.Length > 3 && args[3] == "gunzip")
    {
        using var gz = new GZipStream(ms, CompressionMode.Decompress);
        using var fs = File.Create(args[2]); await gz.CopyToAsync(fs);
    }
    else File.WriteAllBytes(args[2], ms.ToArray());
    Console.WriteLine($"{args[1]} -> {args[2]}");
}
