[CmdletBinding()]
param(
    [string]$AccessToken,
    [string]$TemplateNamesSource = "C:\Nik\clinqetshared\Constants\WhatsAppTemplateNames.cs"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$WABAS = [ordered]@{ "CANADA" = "1302322178177914"; "INDIA" = "2518598361929331" }
$EXPECTED_LOCALES = @{ "CANADA" = @('en_US','es','fr_CA','gu','hi'); "INDIA" = @('en_US','gu','hi') }
$FORBIDDEN_IN_INDIA = @('es','fr_CA')
$PROOF_NAMES = @(
    'clinket_ai_minutes_balance_notice_es','clinket_ai_minutes_balance_notice_fr',
    'clinket_contact_permission_notice_es','clinket_plan_trial_status_update'
)

function Get-Token {
    if (-not [string]::IsNullOrWhiteSpace($AccessToken)) { return $AccessToken }
    if (-not [string]::IsNullOrWhiteSpace($env:CLINKET_WHATSAPP_ACCESS_TOKEN)) { return $env:CLINKET_WHATSAPP_ACCESS_TOKEN }
    $secure = Read-Host "Meta WhatsApp access token" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$token = Get-Token

function Get-AllTemplates {
    param([string]$WabaId)
    $all = @()
    $url = "https://graph.facebook.com/v25.0/$WabaId/message_templates?fields=id,name,language,status,category,components&limit=100"
    while ($url) {
        $f = [System.IO.Path]::GetTempFileName()
        try {
            curl.exe -s -o $f $url -H "Authorization: Bearer $token" | Out-Null
            $j = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
            if ($j.PSObject.Properties['error']) { throw "Meta read failed: $($j.error.message)" }
            $all += $j.data
            $url = if ($j.PSObject.Properties['paging'] -and $j.paging.PSObject.Properties['next']) { $j.paging.next } else { $null }
        }
        finally { Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue }
    }
    return $all
}

function Get-ReadableStrings {
    param([object]$Template)
    $out = @()
    foreach ($c in $Template.components) {
        if ($c.PSObject.Properties['text']) { $out += [pscustomobject]@{ Part = [string]$c.type; Text = [string]$c.text } }
        if ($c.PSObject.Properties['buttons']) {
            foreach ($b in $c.buttons) {
                if ($b.PSObject.Properties['text']) { $out += [pscustomobject]@{ Part = "BUTTON"; Text = [string]$b.text } }
            }
        }
        if ($c.PSObject.Properties['example']) {
            foreach ($p in $c.example.PSObject.Properties) {
                foreach ($v in @($p.Value)) { foreach ($vv in @($v)) {
                    # Meta rewrites media examples to CDN URLs whose '?' query separator is not corruption.
                    if ($vv -is [string] -and $vv -notmatch '^https?://') { $out += [pscustomobject]@{ Part = "EXAMPLE"; Text = $vv } }
                } }
            }
        }
    }
    return $out
}

$CHECKS = [ordered]@{
    "charset loss (letter?letter)"  = '(?<=\p{L})\?(?=\p{L})'
    "charset loss (isolated ?)"     = '\p{L}\s\?\s\p{L}'
    "U+FFFD replacement char"       = "\uFFFD"
    "double-encoded UTF-8"          = '[\u00C3\u00C2][\u0080-\u00BF]'
    "smart-quote mojibake"          = '\u00E2\u0080'
    "control characters"            = '[\x00-\x08\x0B\x0C\x0E-\x1F]'
}
$NATIVE_SCRIPT = @{ "hi" = '\p{IsDevanagari}'; "gu" = '\p{IsGujarati}' }

$live = [ordered]@{}
foreach ($label in $WABAS.Keys) { $live[$label] = @(Get-AllTemplates -WabaId $WABAS[$label]) }

$damage = @(); $scriptGaps = @(); $fieldCount = @{}
foreach ($label in $WABAS.Keys) {
    $n = 0
    foreach ($t in $live[$label]) {
        foreach ($s in (Get-ReadableStrings -Template $t)) {
            $n++
            foreach ($k in $CHECKS.Keys) {
                if ([regex]::IsMatch($s.Text, $CHECKS[$k])) {
                    $damage += [pscustomobject]@{ Waba=$label; Name=$t.name; Lang=$t.language; Part=$s.Part; Issue=$k; Id=$t.id
                        Sample = ([regex]::Match($s.Text, ".{0,32}$($CHECKS[$k]).{0,32}")).Value }
                }
            }
            if ($s.Part -ceq 'BODY' -and $NATIVE_SCRIPT.ContainsKey($t.language) -and -not [regex]::IsMatch($s.Text, $NATIVE_SCRIPT[$t.language])) {
                $scriptGaps += [pscustomobject]@{ Waba=$label; Name=$t.name; Lang=$t.language; Id=$t.id }
            }
        }
    }
    $fieldCount[$label] = $n
}

Write-Host "===== 1. CHARACTER INTEGRITY ====="
foreach ($label in $WABAS.Keys) { Write-Host ("  {0,-7} {1,3} variants / {2,4} readable fields" -f $label, @($live[$label]).Count, $fieldCount[$label]) }
if ($damage.Count -eq 0) { Write-Host "  CLEAN - no broken accents or symbols on either WABA." }
else {
    $damage | Sort-Object Waba,Name,Lang | Format-Table Waba,Name,Lang,Part,Issue,Id -AutoSize
    foreach ($d in $damage) { Write-Host ("    {0}/{1}/{2} {3}: ...{4}..." -f $d.Waba,$d.Name,$d.Lang,$d.Part,$d.Sample) }
}
if ($scriptGaps.Count -gt 0) { Write-Host "  !! hi/gu body without native script:"; $scriptGaps | Format-Table -AutoSize }
else { Write-Host "  Native-script check: every hi/gu body contains its own script." }

Write-Host "`n===== 2. CATEGORY / STATUS DISCREPANCIES ====="
$bad = @()
foreach ($label in $WABAS.Keys) {
    $bad += @($live[$label] | Where-Object { ($_.category -cne 'UTILITY' -and $_.category -cne 'AUTHENTICATION') -or $_.status -cne 'APPROVED' } |
        ForEach-Object { [pscustomobject]@{ Waba=$label; Name=$_.name; Lang=$_.language; Status=$_.status; Category=$_.category; Id=$_.id } })
}
if ($bad.Count -eq 0) { Write-Host "  All templates APPROVED and UTILITY/AUTHENTICATION." } else { $bad | Format-Table -AutoSize }

Write-Host "===== 3. LOCALE COMPLETENESS (Canada 5 langs / India 3 langs) ====="
$runtimeNames = @()
if (Test-Path -LiteralPath $TemplateNamesSource) {
    $src = [System.IO.File]::ReadAllText($TemplateNamesSource, [System.Text.Encoding]::UTF8)
    $runtimeNames = @([regex]::Matches($src, '"(clinket_[a-z0-9_]+)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
} else { Write-Host "  (runtime contract not found at $TemplateNamesSource - reporting Meta-only)" }

$names = @((@($live['CANADA'].name) + @($live['INDIA'].name) + $runtimeNames) | Select-Object -Unique | Sort-Object)
$rows = @()
foreach ($name in $names) {
    if ($name -in $PROOF_NAMES) { continue }
    foreach ($label in $WABAS.Keys) {
        $present = @($live[$label] | Where-Object { $_.name -ceq $name })
        if ($present.Count -eq 0) { $rows += [pscustomobject]@{ Waba=$label; Template=$name; Issue="NAME ABSENT ENTIRELY"; Detail="" }; continue }
        if (@($present.category) -contains 'AUTHENTICATION') { continue }
        $have = @($present | Where-Object { $_.status -ceq 'APPROVED' } | ForEach-Object { $_.language })
        $missing = @($EXPECTED_LOCALES[$label] | Where-Object { $_ -notin $have })
        if ($missing.Count -gt 0) { $rows += [pscustomobject]@{ Waba=$label; Template=$name; Issue="locales not APPROVED"; Detail=($missing -join ',') } }
    }
}
if ($rows.Count -eq 0) { Write-Host "  Every template has its full locale set in both regions." } else { $rows | Sort-Object Template,Waba | Format-Table Waba,Template,Issue,Detail -AutoSize }

Write-Host "===== 4. INDIA RULE (no Spanish, no French) ====="
$viol = @($live['INDIA'] | Where-Object { $_.language -in $FORBIDDEN_IN_INDIA })
if ($viol.Count -eq 0) { Write-Host "  none" } else { $viol | Select-Object name,language,status,category,id | Sort-Object name | Format-Table -AutoSize }

Write-Host "===== 5. NAMES PRESENT IN ONE REGION ONLY ====="
$caN = @($live['CANADA'].name | Select-Object -Unique); $inN = @($live['INDIA'].name | Select-Object -Unique)
Write-Host "  CANADA only:"; @($caN | Where-Object { $_ -notin $inN } | Sort-Object) | ForEach-Object { Write-Host ("     {0}{1}" -f $_, $(if ($_ -in $PROOF_NAMES) { "  (JOB 2 proof - expected)" } else { "" })) }
$only = @($inN | Where-Object { $_ -notin $caN } | Sort-Object)
Write-Host "  INDIA only :"; if ($only.Count -eq 0) { Write-Host "     (none)" } else { $only | ForEach-Object { Write-Host "     $_" } }
