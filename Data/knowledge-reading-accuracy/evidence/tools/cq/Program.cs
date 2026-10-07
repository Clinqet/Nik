using Microsoft.Azure.Cosmos;
using Newtonsoft.Json.Linq;
// cq <region> <container> <pk|*> "<sql>" <outFile>   — full JSON array to a file (scratch tool, sandbox only)
var region = args[0]; var container = args[1]; var pk = args[2]; var sql = args[3]; var outFile = args[4];
var cfg = JObject.Parse(File.ReadAllText(region == "in" ? @"C:\Nik\cosmosindexsetup\appsettings.in.json" : @"C:\Nik\cosmosindexsetup\appsettings.ca.json"));
using var cosmos = new CosmosClient((string)cfg["CosmosDb"]!["ConnectionString"]!, new CosmosClientOptions { ConnectionMode = ConnectionMode.Gateway });
var c = cosmos.GetContainer("Clinket-nonprod", container);
var opts = new QueryRequestOptions { MaxItemCount = 200 };
if (pk != "*") opts.PartitionKey = new PartitionKey(pk);
using var it = c.GetItemQueryIterator<JToken>(new QueryDefinition(sql), requestOptions: opts);
var all = new JArray(); double ru = 0;
while (it.HasMoreResults) { var page = await it.ReadNextAsync(); ru += page.RequestCharge; foreach (var x in page) all.Add(x); }
File.WriteAllText(outFile, all.ToString(Newtonsoft.Json.Formatting.Indented));
Console.WriteLine($"items={all.Count} ru={ru:F2} -> {outFile}");
