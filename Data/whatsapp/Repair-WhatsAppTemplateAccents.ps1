[CmdletBinding()]
param(
    [ValidateSet("Status", "Repair")]
    [string]$Mode = "Status",

    [string]$AccessToken,

    [string]$PlanPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($PlanPath)) {
    if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) { throw "PlanPath is required when the script has no file location." }
    $PlanPath = Join-Path $PSScriptRoot "whatsapp-utility-recreation-plan.json"
}

# Reading through .NET with an explicit UTF8 encoding — Get-Content -Raw honours the console codepage and
# would silently mangle the accented wording this script exists to restore.
function Read-Utf8Json {
    param([string]$Path)
    return ([System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8) | ConvertFrom-Json)
}

# PS 5.1 ConvertTo-Json emits RAW non-ASCII and Invoke-RestMethod then sends it as Windows-1252, so every
# accent arrives at Meta as '?'. Escaping to \uXXXX makes the payload pure ASCII and immune to that.
function ConvertTo-AsciiJson {
    param([object]$Value)
    $json = $Value | ConvertTo-Json -Depth 100 -Compress
    $ascii = [regex]::Replace($json, '[^\x00-\x7F]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
    if ([regex]::IsMatch($ascii, '[^\x00-\x7F]')) { throw "Payload is not pure ASCII; refusing to send." }
    return $ascii
}

function Get-Token {
    if (-not [string]::IsNullOrWhiteSpace($AccessToken)) { return $AccessToken }
    if (-not [string]::IsNullOrWhiteSpace($env:CLINKET_WHATSAPP_ACCESS_TOKEN)) { return $env:CLINKET_WHATSAPP_ACCESS_TOKEN }
    $secure = Read-Host "Meta WhatsApp access token" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Get-LiveVariants {
    param([string]$Name)
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        curl.exe -s -o $tmp "https://graph.facebook.com/$($script:Plan.graphApiVersion)/$($script:Plan.canadaWabaId)/message_templates?name=$([Uri]::EscapeDataString($Name))&fields=id,name,language,status,category,components&limit=100" -H "Authorization: Bearer $script:Token" | Out-Null
        $json = [System.IO.File]::ReadAllText($tmp, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        if ($json.PSObject.Properties['error']) { throw "Meta read failed for ${Name}: $($json.error.message)" }
        return @($json.data)
    }
    finally { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
}

function Get-ComponentText {
    param([object[]]$Components)
    $parts = @()
    foreach ($c in $Components) {
        if ($c.PSObject.Properties['text'])    { $parts += [string]$c.text }
        if ($c.PSObject.Properties['buttons']) { foreach ($b in $c.buttons) { $parts += [string]$b.text } }
    }
    return ($parts -join "`u{241F}")
}

$script:Plan  = Read-Utf8Json -Path $PlanPath
$script:Token = Get-Token
if ([string]::IsNullOrWhiteSpace($script:Token)) { throw "A non-empty Meta access token is required." }

$report = [System.Collections.Generic.List[object]]::new()

foreach ($entry in @($script:Plan.entries)) {
    $live = @(Get-LiveVariants -Name ([string]$entry.originalTemplateName) |
        Where-Object { $_.language -ceq [string]$entry.targetLanguage })
    if ($live.Count -eq 0) { continue }
    if ($live.Count -gt 1) { throw "$($entry.key) has duplicate live variants." }
    $variant = $live[0]

    $expected = Get-ComponentText -Components @($entry.components)
    $actual   = Get-ComponentText -Components @($variant.components)
    $exact    = [string]::Equals($expected, $actual, [StringComparison]::Ordinal)
    $mojibake = [regex]::IsMatch($actual, '(?<=\p{L})\?(?=\p{L})|\uFFFD')
    $marketing = [string]$variant.category -ceq "MARKETING"

    # A status report must never die on the first bad row, or it hides the state of everything after it.
    $action = if ($exact -and -not $marketing) { "None - already exact" }
              elseif ([string]$variant.status -ceq "PENDING") { "BLOCKED - Meta forbids editing a PENDING template (subcode 2388003). Re-run after review completes." }
              elseif ($marketing -and $exact) { "!! MARKETING and text is correct - only Meta can reclassify. Do NOT delete." }
              elseif ($marketing) { "Repairable text; category stays MARKETING until Meta re-reviews. Never send 'category' on an edit (subcode 3835031)." }
              else { "Repairable" }

    $report.Add([pscustomobject]@{
        Key = [string]$entry.key; Language = [string]$variant.language; Id = [string]$variant.id
        Status = [string]$variant.status; Category = [string]$variant.category
        Exact = $exact; Mojibake = $mojibake; Action = $action
    })

    if ($Mode -cne "Repair" -or $exact -or [string]$variant.status -ceq "PENDING") { continue }

    $payloadFile = [System.IO.Path]::GetTempFileName()
    $respFile    = [System.IO.Path]::GetTempFileName()
    try {
        $ascii = ConvertTo-AsciiJson -Value ([ordered]@{ components = @($entry.components) })
        [System.IO.File]::WriteAllText($payloadFile, $ascii, (New-Object System.Text.UTF8Encoding($false)))
        curl.exe -s -o $respFile -X POST "https://graph.facebook.com/$($script:Plan.graphApiVersion)/$($variant.id)" `
            -H "Authorization: Bearer $script:Token" -H "Content-Type: application/json" --data-binary "@$payloadFile" | Out-Null
        $resp = [System.IO.File]::ReadAllText($respFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        if ($resp.PSObject.Properties['error']) { throw "Edit failed for $($entry.key): $($resp.error.error_user_msg)" }

        $after = @(Get-LiveVariants -Name ([string]$entry.originalTemplateName) | Where-Object { $_.id -ceq [string]$variant.id })
        $afterText = Get-ComponentText -Components @($after[0].components)
        if (-not [string]::Equals($expected, $afterText, [StringComparison]::Ordinal)) {
            throw "$($entry.key) still does not match the plan byte-for-byte after the edit."
        }
        ($report | Where-Object { $_.Key -ceq $entry.key }).Action = "REPAIRED - verified byte-exact"
    }
    finally {
        Remove-Item -LiteralPath $payloadFile, $respFile -Force -ErrorAction SilentlyContinue
    }
}

$report
