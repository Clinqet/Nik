using System.Text.Json;
using Microsoft.Azure.Cosmos;
using Newtonsoft.Json.Linq;
// usage: cread <region> read <container> <pk> <id> [out.json]
//        cread <region> query <container> <pk> "<sql>"      (always partition-scoped)
var region = args[0];
var cfg = JsonDocument.Parse(File.ReadAllText($@"C:\Nik\cosmosindexsetup\appsettings.{region}.json").TrimStart('\uFEFF'));
var cs = cfg.RootElement.GetProperty("CosmosDb").GetProperty("ConnectionString").GetString()!;
var dbName = Environment.GetEnvironmentVariable("CREAD_DB") ?? "clinket-dev";
using var client = new CosmosClient(cs, new CosmosClientOptions { ConnectionMode = ConnectionMode.Gateway });
if (args[1] == "dbs") { var it = client.GetDatabaseQueryIterator<JObject>(); while (it.HasMoreResults) foreach (var d in await it.ReadNextAsync()) Console.WriteLine(d["id"]); return; }
var container = client.GetContainer(dbName, args[2]);
if (args[1] == "read")
{
    var r = await container.ReadItemAsync<JObject>(args[4], new PartitionKey(args[3]));
    var text = r.Resource.ToString(Newtonsoft.Json.Formatting.None);
    Console.Error.WriteLine($"bytes={System.Text.Encoding.UTF8.GetByteCount(text)} ru={r.RequestCharge}");
    if (args.Length > 5) File.WriteAllText(args[5], r.Resource.ToString()); else Console.WriteLine(r.Resource.ToString());
}
else if (args[1] == "query")
{
    var q = container.GetItemQueryIterator<JObject>(new QueryDefinition(args[4]), requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(args[3]) });
    double ru = 0;
    while (q.HasMoreResults) { var page = await q.ReadNextAsync(); ru += page.RequestCharge; foreach (var d in page) Console.WriteLine(d.ToString(Newtonsoft.Json.Formatting.None)); }
    Console.Error.WriteLine($"ru={ru}");
}
