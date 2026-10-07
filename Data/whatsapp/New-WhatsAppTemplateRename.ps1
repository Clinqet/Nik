[CmdletBinding()]
param(
    [ValidateSet("Plan", "Create", "Verify")]
    [string]$Mode = "Plan",

    [string]$AccessToken
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$GRAPH = "https://graph.facebook.com/v25.0"
$WABAS = [ordered]@{ CANADA = "1302322178177914"; INDIA = "2518598361929331" }

# India deliberately never carries Spanish or French; Canada carries all five.
$ALLOWED = @{ CANADA = @('en_US','es','fr_CA','gu','hi'); INDIA = @('en_US','gu','hi') }

$RENAMES = [ordered]@{
    'clinket_ai_minutes_low'      = 'clinket_ai_minutes_remaining'
    'clinket_optin_first_contact' = 'clinket_chat_consent_request'
    'clinket_plan_trial_ended'    = 'clinket_plan_moved_to_free'
}

function Get-Token {
    if (-not [string]::IsNullOrWhiteSpace($AccessToken)) { return $AccessToken }
    if (-not [string]::IsNullOrWhiteSpace($env:CLINKET_WHATSAPP_ACCESS_TOKEN)) { return $env:CLINKET_WHATSAPP_ACCESS_TOKEN }
    $s = Read-Host "Meta WhatsApp access token" -AsSecureString
    $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }
}
$script:Token = Get-Token

# Every Meta read goes through a file decoded as UTF-8. Rendering template text to the console would
# transcode it to the ANSI codepage and destroy Devanagari/Gujarati before it could be re-submitted.
function Invoke-Read {
    param([string]$Url)
    $f = [System.IO.Path]::GetTempFileName()
    try {
        curl.exe -s -o $f $Url -H "Authorization: Bearer $script:Token" | Out-Null
        $j = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        if ($j.PSObject.Properties['error']) { throw "Meta read failed: $($j.error.message)" }
        return $j
    }
    finally { Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue }
}

function Invoke-Write {
    param([string]$Url, [object]$Body)
    $json  = $Body | ConvertTo-Json -Depth 100 -Compress
    $ascii = [regex]::Replace($json, '[^\x00-\x7F]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
    if ([regex]::IsMatch($ascii, '[^\x00-\x7F]')) { throw "Payload is not pure ASCII; refusing to send." }

    # Decode the exact bytes we are about to send and compare to the source. A single altered character
    # anywhere — Devanagari, Gujarati, French, Spanish — aborts the send instead of reaching Meta.
    if ($Body.Contains('components')) {
        $decoded = ($ascii | ConvertFrom-Json).components
        $before = Get-Text -Components @($Body['components'])
        $after  = Get-Text -Components @($decoded)
        if (-not [string]::Equals($before, $after, [StringComparison]::Ordinal)) {
            throw "Payload does not round-trip losslessly; refusing to send."
        }
    }

    $pf = [System.IO.Path]::GetTempFileName(); $rf = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($pf, $ascii, (New-Object System.Text.UTF8Encoding($false)))
        curl.exe -s -o $rf -X POST $Url -H "Authorization: Bearer $script:Token" -H "Content-Type: application/json" --data-binary "@$pf" | Out-Null
        return ([System.IO.File]::ReadAllText($rf, [System.Text.Encoding]::UTF8) | ConvertFrom-Json)
    }
    finally { Remove-Item -LiteralPath $pf, $rf -Force -ErrorAction SilentlyContinue }
}

function Get-Variants {
    param([string]$WabaId, [string]$Name)
    return @((Invoke-Read -Url "$GRAPH/$WabaId/message_templates?name=$([Uri]::EscapeDataString($Name))&fields=id,name,language,status,category,components&limit=50").data |
        Where-Object { $_.name -ceq $Name })
}

# Meta echoes back fields it will not accept on create; rebuild each component from scratch.
function ConvertTo-CreatePayloadComponents {
    param([object[]]$Components)
    $out = @()
    foreach ($c in $Components) {
        switch ([string]$c.type) {
            'BODY' {
                $body = [ordered]@{ type = 'BODY'; text = [string]$c.text }
                if ($c.PSObject.Properties['example'] -and $c.example.PSObject.Properties['body_text']) {
                    $body['example'] = [ordered]@{ body_text = @($c.example.body_text | ForEach-Object { ,@($_ | ForEach-Object { [string]$_ }) }) }
                }
                $out += $body
            }
            'FOOTER' { $out += [ordered]@{ type = 'FOOTER'; text = [string]$c.text } }
            'BUTTONS' {
                $btns = @()
                foreach ($b in $c.buttons) {
                    $nb = [ordered]@{ type = [string]$b.type; text = [string]$b.text }
                    if ($b.PSObject.Properties['url']) { $nb['url'] = [string]$b.url }
                    $btns += $nb
                }
                $out += [ordered]@{ type = 'BUTTONS'; buttons = $btns }
            }
            default { throw "Unhandled component type '$($c.type)' - refusing to guess." }
        }
    }
    return $out
}

function Get-Text {
    param([Parameter(Mandatory)][object[]]$Components)
    $p = @()
    foreach ($c in $Components) {
        # Components arrive either as PSCustomObject (parsed from Meta) or OrderedDictionary (rebuilt here).
        $text    = if ($c -is [System.Collections.IDictionary]) { if ($c.Contains('text')) { $c['text'] } else { $null } }
                   elseif ($c.PSObject.Properties['text']) { $c.text } else { $null }
        $buttons = if ($c -is [System.Collections.IDictionary]) { if ($c.Contains('buttons')) { $c['buttons'] } else { $null } }
                   elseif ($c.PSObject.Properties['buttons']) { $c.buttons } else { $null }

        if ($null -ne $text) { $p += [string]$text }
        if ($null -ne $buttons) {
            foreach ($b in $buttons) {
                $bt = if ($b -is [System.Collections.IDictionary]) { $b['text'] } else { $b.text }
                $p += [string]$bt
            }
        }
    }
    if ($p.Count -eq 0) { throw "Get-Text extracted nothing; refusing to treat an empty read as a match." }
    return ($p -join "`u{241F}")
}

$results = [System.Collections.Generic.List[object]]::new()

foreach ($waba in $WABAS.Keys) {
    $wabaId = $WABAS[$waba]
    foreach ($oldName in $RENAMES.Keys) {
        $newName = $RENAMES[$oldName]
        $sources = @(Get-Variants -WabaId $wabaId -Name $oldName | Where-Object { $_.language -in $ALLOWED[$waba] })
        $existing = @(Get-Variants -WabaId $wabaId -Name $newName)

        foreach ($src in ($sources | Sort-Object language)) {
            $already = @($existing | Where-Object { $_.language -ceq $src.language })
            $row = [ordered]@{
                Waba = $waba; NewName = $newName; Lang = [string]$src.language
                SourceCategory = [string]$src.category; Action = ""; Id = ""; Status = ""; Category = ""; TextExact = $null
            }

            if ($already.Count -gt 0) {
                $row.Action = "already exists"; $row.Id = [string]$already[0].id
                $row.Status = [string]$already[0].status; $row.Category = [string]$already[0].category
                $row.TextExact = [string]::Equals((Get-Text -Components @($src.components)), (Get-Text -Components @($already[0].components)), [StringComparison]::Ordinal)
                $results.Add([pscustomobject]$row); continue
            }

            if ($Mode -cne "Create") { $row.Action = "WOULD CREATE"; $results.Add([pscustomobject]$row); continue }

            $payload = [ordered]@{
                name                  = $newName
                language              = [string]$src.language
                category              = "UTILITY"
                allow_category_change = $false
                components            = @(ConvertTo-CreatePayloadComponents -Components @($src.components))
            }
            $resp = Invoke-Write -Url "$GRAPH/$wabaId/message_templates" -Body $payload
            if ($resp.PSObject.Properties['error']) {
                $msg = if ($resp.error.PSObject.Properties['error_user_msg']) { [string]$resp.error.error_user_msg } else { [string]$resp.error.message }
                $row.Action = "FAILED: $msg"
                $results.Add([pscustomobject]$row); continue
            }
            $row.Action = "created"; $row.Id = [string]$resp.id
            $row.Status = [string]$resp.status; $row.Category = [string]$resp.category
            $results.Add([pscustomobject]$row)
        }
    }
}

if ($Mode -ceq "Verify" -or $Mode -ceq "Create") {
    Write-Host "`n---- re-reading Meta for final state ----"
    $final = [System.Collections.Generic.List[object]]::new()
    foreach ($waba in $WABAS.Keys) {
        foreach ($oldName in $RENAMES.Keys) {
            $newName = $RENAMES[$oldName]
            $src = @(Get-Variants -WabaId $WABAS[$waba] -Name $oldName | Where-Object { $_.language -in $ALLOWED[$waba] })
            foreach ($v in (Get-Variants -WabaId $WABAS[$waba] -Name $newName | Sort-Object language)) {
                $match = @($src | Where-Object { $_.language -ceq $v.language })
                $exact = $match.Count -eq 1 -and [string]::Equals((Get-Text -Components @($match[0].components)), (Get-Text -Components @($v.components)), [StringComparison]::Ordinal)
                $mojibake = [regex]::IsMatch((Get-Text -Components @($v.components)), '(?<=\p{L})\?(?=\p{L})|\uFFFD')
                $final.Add([pscustomobject]@{
                    Waba = $waba; Name = $newName; Lang = [string]$v.language; Id = [string]$v.id
                    Status = [string]$v.status; Category = [string]$v.category; TextExact = $exact; Mojibake = $mojibake
                })
            }
        }
    }
    $final | Format-Table Waba, Name, Lang, Status, Category, TextExact, Mojibake -AutoSize
    Write-Host ("TOTAL={0}  UTILITY={1}  MARKETING={2}  TextExact={3}  Mojibake={4}" -f `
        $final.Count,
        @($final | Where-Object { $_.Category -ceq 'UTILITY' }).Count,
        @($final | Where-Object { $_.Category -ceq 'MARKETING' }).Count,
        @($final | Where-Object { $_.TextExact }).Count,
        @($final | Where-Object { $_.Mojibake }).Count)
    return
}

$results | Format-Table Waba, NewName, Lang, SourceCategory, Action, Status, Category -AutoSize
Write-Host ("Planned/created: {0}" -f $results.Count)
