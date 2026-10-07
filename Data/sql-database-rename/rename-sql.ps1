# Renames the SQL database identity-<env> -> clinket-<env> on every server in the current subscription,
# and points every App Service / Function App connection string at the new name.
# Run in Azure Cloud Shell (PowerShell):  ./rename-sql.ps1   (dry run)   then   ./rename-sql.ps1 -Apply
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$Renames = [ordered]@{ 'identity-dev' = 'clinket-dev'; 'identity-uat' = 'clinket-uat' }
$Api = 'api-version=2023-12-01'

function Invoke-Arm($Method, $Path, $Payload) {
    $r = if ($Payload) { Invoke-AzRestMethod -Method $Method -Path $Path -Payload $Payload }
         else          { Invoke-AzRestMethod -Method $Method -Path $Path }
    if ($r.StatusCode -ge 300) { throw "$Method $Path failed ($($r.StatusCode)): $($r.Content)" }
    $r
}
function Read-ConnStrings($Id) { ((Invoke-Arm POST "$Id/config/connectionstrings/list?$Api").Content | ConvertFrom-Json).properties }
function Read-AppSettings($Id) { ((Invoke-Arm POST "$Id/config/appsettings/list?$Api").Content | ConvertFrom-Json).properties }
function Convert-Catalog([string]$Value) {
    foreach ($old in $Renames.Keys) {
        $Value = $Value -replace "(?i)((?:Initial Catalog|Database)\s*=\s*)$([regex]::Escape($old))(?=;|$)", "`${1}$($Renames[$old])"
    }
    $Value
}
function Get-Catalog([string]$Value) { if ($Value -match '(?i)(?:Initial Catalog|Database)\s*=\s*([^;]+)') { $Matches[1] } }
function Get-AllSqlServers { Get-AzResourceGroup | Get-AzSqlServer }

Write-Host "Subscription: $((Get-AzContext).Subscription.Name)" -ForegroundColor Cyan

$dbs = foreach ($srv in Get-AllSqlServers) {
    $names = @((Get-AzSqlDatabase -ResourceGroupName $srv.ResourceGroupName -ServerName $srv.ServerName).DatabaseName)
    foreach ($old in $Renames.Keys) {
        $new = $Renames[$old]
        if (($names -contains $old) -and ($names -contains $new)) { throw "$($srv.ServerName) has BOTH '$old' and '$new' - stop and send this output." }
        if ($names -contains $old) { [pscustomobject]@{ Rg = $srv.ResourceGroupName; Server = $srv.ServerName; Old = $old; New = $new } }
        elseif ($names -contains $new) { Write-Host "  $($srv.ServerName): already '$new'" }
    }
}

$sites = foreach ($site in Get-AzResource -ResourceType 'Microsoft.Web/sites') {
    $cs = Read-ConnStrings $site.ResourceId
    $as = Read-AppSettings $site.ResourceId
    $csHit = @($cs.PSObject.Properties | Where-Object { $_.Value.value -and (Convert-Catalog $_.Value.value) -ne $_.Value.value } | ForEach-Object Name)
    $asHit = @($as.PSObject.Properties | Where-Object { $_.Value -and (Convert-Catalog $_.Value) -ne $_.Value } | ForEach-Object Name)
    if ($csHit.Count -or $asHit.Count) { [pscustomobject]@{ Name = $site.Name; Id = $site.ResourceId; Cs = $cs; CsHit = $csHit; AsHit = $asHit } }
}

Write-Host "`nDatabases to rename:"
foreach ($d in $dbs) { Write-Host "  $($d.Server): $($d.Old) -> $($d.New)" }
Write-Host "Apps to stop, update and start again:"
foreach ($s in $sites) { Write-Host "  $($s.Name)  [$($s.CsHit -join ', ')]" }
$inAppSettings = @($sites | Where-Object { $_.AsHit.Count })
if ($inAppSettings.Count) {
    foreach ($s in $inAppSettings) { Write-Host "  $($s.Name) has it in APP SETTINGS: $($s.AsHit -join ', ')" -ForegroundColor Red }
    throw "The database name is also in app settings. Send this output before applying."
}
if (-not $Apply) { Write-Host "`nDry run - nothing changed. Run again with -Apply." -ForegroundColor Yellow; return }

try {
    foreach ($s in $sites) { Invoke-Arm POST "$($s.Id)/stop?$Api" | Out-Null; Write-Host "  stopped $($s.Name)" }
    if ($sites) { Start-Sleep -Seconds 30 }   # Azure refuses a rename while any connection is open
    foreach ($d in $dbs) {
        Set-AzSqlDatabase -ResourceGroupName $d.Rg -ServerName $d.Server -DatabaseName $d.Old -NewName $d.New | Out-Null
        Write-Host "  renamed $($d.Server): $($d.Old) -> $($d.New)" -ForegroundColor Green
    }
    foreach ($s in $sites) {
        foreach ($n in $s.CsHit) { $s.Cs.$n.value = Convert-Catalog $s.Cs.$n.value }
        Invoke-Arm PUT "$($s.Id)/config/connectionstrings?$Api" (@{ properties = $s.Cs } | ConvertTo-Json -Depth 6) | Out-Null
        Write-Host "  updated $($s.Name)" -ForegroundColor Green
    }
}
finally {
    foreach ($s in $sites) { Invoke-Arm POST "$($s.Id)/start?$Api" | Out-Null; Write-Host "  started $($s.Name)" }
}

Write-Host "`nAfter:"
foreach ($srv in Get-AllSqlServers) {
    Get-AzSqlDatabase -ResourceGroupName $srv.ResourceGroupName -ServerName $srv.ServerName |
        Where-Object DatabaseName -ne 'master' | ForEach-Object { Write-Host "  $($srv.ServerName) / $($_.DatabaseName)" }
}
foreach ($s in $sites) {
    foreach ($p in (Read-ConnStrings $s.Id).PSObject.Properties) { Write-Host "  $($s.Name) $($p.Name) -> $(Get-Catalog $p.Value.value)" }
}
