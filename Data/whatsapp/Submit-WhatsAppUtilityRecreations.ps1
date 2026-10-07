[CmdletBinding()]
param(
    [ValidateSet("Auto", "Validate", "Status", "RecreateOriginals", "CleanupProofs")]
    [string]$Mode = "Auto",

    [string]$TargetKey,

    [string]$AccessToken,

    [string]$PlanPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($PlanPath)) {
    if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) {
        throw "PlanPath is required when the script has no file location."
    }
    $PlanPath = Join-Path $PSScriptRoot "whatsapp-utility-recreation-plan.json"
}

function ConvertTo-CanonicalNode {
    param(
        [AllowNull()]
        [object]$Value
    )

    if ($null -eq $Value) {
        return $null
    }

    if ($Value -is [string] -or $Value -is [ValueType]) {
        return $Value
    }

    if ($Value -is [System.Collections.IDictionary]) {
        $ordered = [ordered]@{}
        foreach ($key in @($Value.Keys | Sort-Object)) {
            $ordered[[string]$key] = ConvertTo-CanonicalNode -Value $Value[$key]
        }
        return [pscustomobject]$ordered
    }

    if ($Value -is [pscustomobject]) {
        $ordered = [ordered]@{}
        foreach ($property in @($Value.PSObject.Properties | Sort-Object Name)) {
            $ordered[$property.Name] = ConvertTo-CanonicalNode -Value $property.Value
        }
        return [pscustomobject]$ordered
    }

    if ($Value -is [System.Collections.IEnumerable]) {
        $items = [System.Collections.Generic.List[object]]::new()
        foreach ($item in $Value) {
            [void]$items.Add((ConvertTo-CanonicalNode -Value $item))
        }
        return ,$items.ToArray()
    }

    return [string]$Value
}

function Get-CanonicalJson {
    param(
        [AllowNull()]
        [object]$Value
    )

    return (ConvertTo-CanonicalNode -Value $Value | ConvertTo-Json -Depth 100 -Compress)
}

function Assert-Equal {
    param(
        [AllowNull()]
        [object]$Actual,

        [AllowNull()]
        [object]$Expected,

        [string]$Label
    )

    if ([string]$Actual -cne [string]$Expected) {
        throw "$Label mismatch. Expected '$Expected'; found '$Actual'."
    }
}

function Assert-Components {
    param(
        [object]$Entry,

        [object[]]$Components
    )

    $actualTypes = @($Components | ForEach-Object { [string]$_.type })
    $expectedTypes = @($Entry.expectedComponentTypes | ForEach-Object { [string]$_ })
    Assert-Equal -Actual ($actualTypes -join "|") -Expected ($expectedTypes -join "|") -Label "$($Entry.key) component types"

    $bodyComponents = @($Components | Where-Object { $_.type -ceq "BODY" })
    if ($bodyComponents.Count -ne 1) {
        throw "$($Entry.key) must contain exactly one BODY component."
    }

    $actualPlaceholders = @(
        [regex]::Matches([string]$bodyComponents[0].text, "\{\{\d+\}\}") |
            ForEach-Object { $_.Value }
    )
    $expectedPlaceholders = @($Entry.expectedPlaceholders | ForEach-Object { [string]$_ })
    Assert-Equal -Actual ($actualPlaceholders -join "|") -Expected ($expectedPlaceholders -join "|") -Label "$($Entry.key) placeholders"

    $actualJson = Get-CanonicalJson -Value $Components
    $expectedJson = Get-CanonicalJson -Value @($Entry.components)
    Assert-Equal -Actual $actualJson -Expected $expectedJson -Label "$($Entry.key) components"

    if ($Entry.key -ceq "optin_first_contact_es") {
        if ([string]$bodyComponents[0].text -cnotmatch "\*YES\*" -or [string]$bodyComponents[0].text -cnotmatch "\*STOP\*") {
            throw "optin_first_contact_es must retain literal YES and STOP commands."
        }

        $buttons = @(
            $Components |
                Where-Object { $_.type -ceq "BUTTONS" } |
                ForEach-Object { @($_.buttons) }
        )
        Assert-Equal -Actual ([string]$buttons[0].text) -Expected "YES / Continuar" -Label "optin_first_contact_es first button"
        Assert-Equal -Actual ([string]$buttons[1].text) -Expected "STOP / Rechazar" -Label "optin_first_contact_es second button"
    }
}

function Read-Plan {
    if (-not (Test-Path -LiteralPath $PlanPath -PathType Leaf)) {
        throw "Plan file not found: $PlanPath"
    }

    return (Get-Content -LiteralPath $PlanPath -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Assert-Plan {
    param(
        [object]$Plan
    )

    Assert-Equal -Actual $Plan.schemaVersion -Expected 1 -Label "schemaVersion"
    Assert-Equal -Actual $Plan.graphApiVersion -Expected "v25.0" -Label "graphApiVersion"
    Assert-Equal -Actual $Plan.canadaWabaId -Expected "1302322178177914" -Label "canadaWabaId"
    Assert-Equal -Actual $Plan.safeNotBeforeUtc -Expected "2026-08-28T00:00:00Z" -Label "safeNotBeforeUtc"
    Assert-Equal -Actual $Plan.policy.defaultMode -Expected "Auto" -Label "defaultMode"
    Assert-Equal -Actual $Plan.policy.requestedCategory -Expected "UTILITY" -Label "requestedCategory"

    if ([bool]$Plan.policy.allowCategoryChange) {
        throw "allowCategoryChange must remain false."
    }
    if (-not [bool]$Plan.policy.marketingIsForbidden) {
        throw "marketingIsForbidden must remain true."
    }
    if (-not [bool]$Plan.policy.recreateOneTargetPerInvocation -or -not [bool]$Plan.policy.cleanupOneProofPerInvocation) {
        throw "Auto mode must remain limited to one Meta mutation per invocation."
    }

    $entries = @($Plan.entries)
    if ($entries.Count -ne 4) {
        throw "The plan must contain exactly four final proof entries."
    }

    $expectedKeys = @(
        "ai_minutes_low_fr",
        "ai_minutes_low_es",
        "optin_first_contact_es",
        "plan_trial_ended_es"
    )
    $actualKeys = @($entries | ForEach-Object { [string]$_.key } | Sort-Object)
    Assert-Equal -Actual ($actualKeys -join "|") -Expected ((@($expectedKeys | Sort-Object)) -join "|") -Label "entry keys"

    if (@($entries.proof.id | Select-Object -Unique).Count -ne $entries.Count) {
        throw "Proof Meta IDs must be unique."
    }
    if (@($entries.proof.name | Select-Object -Unique).Count -ne $entries.Count) {
        throw "Proof names must be unique."
    }
    if (@($entries.key | Select-Object -Unique).Count -ne $entries.Count) {
        throw "Entry keys must be unique."
    }

    foreach ($entry in $entries) {
        Assert-Equal -Actual $entry.proof.status -Expected "APPROVED" -Label "$($entry.key) proof status"
        Assert-Equal -Actual $entry.proof.category -Expected "UTILITY" -Label "$($entry.key) proof category"
        Assert-Equal -Actual $entry.proof.rejectedReason -Expected "NONE" -Label "$($entry.key) rejected reason"
        if ([string]$entry.proof.name -ceq [string]$entry.originalTemplateName) {
            throw "$($entry.key) proof name must not equal its production name."
        }
        Assert-Components -Entry $entry -Components @($entry.components)
    }

    $protectedTemplates = @($Plan.protectedProductionTemplates)
    if ($protectedTemplates.Count -ne 3) {
        throw "The plan must protect exactly three production template names."
    }

    foreach ($template in $protectedTemplates) {
        foreach ($variant in @($template.variants)) {
            Assert-Equal -Actual $variant.status -Expected "APPROVED" -Label "$($template.name)/$($variant.language) protected status"
            Assert-Equal -Actual $variant.category -Expected "UTILITY" -Label "$($template.name)/$($variant.language) protected category"
        }
    }
}

function Get-SecretToken {
    if (-not [string]::IsNullOrWhiteSpace($AccessToken)) {
        return $AccessToken
    }

    if (-not [string]::IsNullOrWhiteSpace($env:CLINKET_WHATSAPP_ACCESS_TOKEN)) {
        return $env:CLINKET_WHATSAPP_ACCESS_TOKEN
    }

    $secureToken = Read-Host "Meta WhatsApp access token" -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Invoke-MetaRequest {
    param(
        [ValidateSet("GET", "POST", "DELETE")]
        [string]$Method,

        [string]$Path,

        [AllowNull()]
        [object]$Body
    )

    $uri = "https://graph.facebook.com/$($script:Plan.graphApiVersion)/$Path"
    $parameters = @{
        Uri         = $uri
        Method      = $Method
        Headers     = @{ Authorization = "Bearer $script:MetaToken" }
        ErrorAction = "Stop"
    }

    if ($null -ne $Body) {
        $parameters.ContentType = "application/json; charset=utf-8"
        # PS 5.1 ConvertTo-Json emits RAW non-ASCII, which Invoke-RestMethod then sends as Windows-1252 —
        # every accent reaches Meta as '?'. Escaping to \uXXXX makes the payload pure ASCII and immune.
        $json = $Body | ConvertTo-Json -Depth 100 -Compress
        $ascii = [regex]::Replace($json, '[^\x00-\x7F]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
        if ([regex]::IsMatch($ascii, '[^\x00-\x7F]')) {
            throw "Refusing to send a non-ASCII payload; accented characters would be corrupted in transit."
        }
        $parameters.Body = $ascii
    }

    try {
        return Invoke-RestMethod @parameters
    }
    catch {
        throw "Meta Graph API $Method failed for the requested template operation: $($_.Exception.Message)"
    }
}

function Get-LiveTemplatesByName {
    param(
        [string]$Name
    )

    $encodedName = [Uri]::EscapeDataString($Name)
    $fields = "id,name,language,status,category,rejected_reason,components"
    $response = Invoke-MetaRequest -Method GET -Path "$($script:Plan.canadaWabaId)/message_templates?name=$encodedName&fields=$fields&limit=100" -Body $null
    return @($response.data)
}

function Get-LiveProofOrNull {
    param(
        [object]$Entry
    )

    $matches = @(
        Get-LiveTemplatesByName -Name ([string]$Entry.proof.name) |
            Where-Object { $_.id -ceq [string]$Entry.proof.id }
    )
    if ($matches.Count -gt 1) {
        throw "$($Entry.key) proof has duplicate live variants."
    }
    if ($matches.Count -eq 0) {
        return $null
    }
    return $matches[0]
}

function Assert-LiveProofObject {
    param(
        [object]$Entry,

        [object]$Live
    )

    $live = $Live
    Assert-Equal -Actual $live.id -Expected $Entry.proof.id -Label "$($Entry.key) live proof ID"
    Assert-Equal -Actual $live.name -Expected $Entry.proof.name -Label "$($Entry.key) live proof name"
    Assert-Equal -Actual $live.language -Expected $Entry.targetLanguage -Label "$($Entry.key) live proof language"

    if ([string]$live.category -ceq "MARKETING") {
        throw "$($Entry.key) is MARKETING. The script refuses to continue."
    }

    Assert-Equal -Actual $live.status -Expected "APPROVED" -Label "$($Entry.key) live proof status"
    Assert-Equal -Actual $live.category -Expected "UTILITY" -Label "$($Entry.key) live proof category"
    Assert-Equal -Actual $live.rejected_reason -Expected "NONE" -Label "$($Entry.key) live proof rejected reason"
    Assert-Components -Entry $Entry -Components @($live.components)
    return $live
}

function Assert-LiveProof {
    param(
        [object]$Entry
    )

    $live = Get-LiveProofOrNull -Entry $Entry
    if ($null -eq $live) {
        throw "$($Entry.key) proof is missing."
    }
    return Assert-LiveProofObject -Entry $Entry -Live $live
}

function Assert-ProtectedProductionVariants {
    foreach ($template in @($script:Plan.protectedProductionTemplates)) {
        $liveVariants = @(Get-LiveTemplatesByName -Name ([string]$template.name))
        foreach ($expected in @($template.variants)) {
            $matches = @($liveVariants | Where-Object { $_.language -ceq [string]$expected.language })
            if ($matches.Count -ne 1) {
                throw "$($template.name)/$($expected.language) protected variant is missing or duplicated."
            }

            $live = $matches[0]
            Assert-Equal -Actual $live.id -Expected $expected.id -Label "$($template.name)/$($expected.language) protected ID"
            if ([string]$live.category -ceq "MARKETING") {
                throw "$($template.name)/$($expected.language) became MARKETING."
            }
            Assert-Equal -Actual $live.status -Expected "APPROVED" -Label "$($template.name)/$($expected.language) protected status"
            Assert-Equal -Actual $live.category -Expected "UTILITY" -Label "$($template.name)/$($expected.language) protected category"
        }
    }
}

function Get-SelectedEntry {
    if ([string]::IsNullOrWhiteSpace($TargetKey)) {
        $keys = @($script:Plan.entries | ForEach-Object { $_.key }) -join ", "
        throw "TargetKey is required for $Mode. Valid keys: $keys"
    }

    $matches = @($script:Plan.entries | Where-Object { $_.key -ceq $TargetKey })
    if ($matches.Count -ne 1) {
        throw "Unknown TargetKey '$TargetKey'."
    }

    return $matches[0]
}

function Assert-CooldownComplete {
    $notBefore = [DateTimeOffset]::Parse([string]$script:Plan.safeNotBeforeUtc)
    if ([DateTimeOffset]::UtcNow -lt $notBefore) {
        throw "Cooldown is active. No recreation or cleanup is allowed before $($notBefore.ToString('u'))."
    }
}

function Get-OriginalTargetVariant {
    param(
        [object]$Entry
    )

    $variants = @(Get-LiveTemplatesByName -Name ([string]$Entry.originalTemplateName))
    $matches = @($variants | Where-Object { $_.language -ceq [string]$Entry.targetLanguage })
    if ($matches.Count -gt 1) {
        throw "$($Entry.originalTemplateName)/$($Entry.targetLanguage) has duplicate live variants."
    }
    if ($matches.Count -eq 0) {
        return $null
    }
    return $matches[0]
}

function Assert-OriginalApprovedUtility {
    param(
        [object]$Entry,

        [object]$Original
    )

    if ([string]$Original.category -ceq "MARKETING") {
        throw "$($Entry.originalTemplateName)/$($Entry.targetLanguage) is MARKETING."
    }
    Assert-Equal -Actual $Original.status -Expected "APPROVED" -Label "$($Entry.key) original status"
    Assert-Equal -Actual $Original.category -Expected "UTILITY" -Label "$($Entry.key) original category"
    Assert-Components -Entry $Entry -Components @($Original.components)
    return $Original
}

function Invoke-Status {
    Assert-ProtectedProductionVariants
    $results = [System.Collections.Generic.List[object]]::new()

    foreach ($entry in @($script:Plan.entries)) {
        $proof = Get-LiveProofOrNull -Entry $entry
        $original = Get-OriginalTargetVariant -Entry $entry
        $proofId = $null
        $proofStatus = "ABSENT"
        $proofCategory = $null
        $originalStatus = "MISSING"
        $originalCategory = $null
        $originalId = $null

        if ($null -ne $proof) {
            $proof = Assert-LiveProofObject -Entry $entry -Live $proof
            $proofId = [string]$proof.id
            $proofStatus = [string]$proof.status
            $proofCategory = [string]$proof.category
        }

        if ($null -ne $original) {
            if ([string]$original.category -ceq "MARKETING") {
                throw "$($entry.originalTemplateName)/$($entry.targetLanguage) is MARKETING."
            }
            Assert-Equal -Actual $original.category -Expected "UTILITY" -Label "$($entry.key) live original category"
            Assert-Components -Entry $entry -Components @($original.components)
            $originalStatus = [string]$original.status
            $originalCategory = [string]$original.category
            $originalId = [string]$original.id
        }

        if ($null -eq $proof -and ($null -eq $original -or [string]$original.status -cne "APPROVED")) {
            throw "$($entry.key) proof is absent before its exact original locale is APPROVED/UTILITY."
        }

        [void]$results.Add([pscustomobject]@{
            Key              = [string]$entry.key
            ProofId          = $proofId
            ProofStatus      = $proofStatus
            ProofCategory    = $proofCategory
            OriginalName     = [string]$entry.originalTemplateName
            TargetLanguage   = [string]$entry.targetLanguage
            OriginalId       = $originalId
            OriginalStatus   = $originalStatus
            OriginalCategory = $originalCategory
        })
    }

    return $results
}

function Submit-OriginalEntry {
    param(
        [object]$Entry
    )

    $payload = [ordered]@{
        name                  = [string]$Entry.originalTemplateName
        language              = [string]$Entry.targetLanguage
        category              = "UTILITY"
        allow_category_change = $false
        components            = @($Entry.components)
    }
    $result = Invoke-MetaRequest -Method POST -Path "$($script:Plan.canadaWabaId)/message_templates" -Body $payload

    if ([string]$result.category -ceq "MARKETING") {
        throw "Meta returned MARKETING for $($Entry.key). The script refuses further actions."
    }
    Assert-Equal -Actual $result.category -Expected "UTILITY" -Label "$($Entry.key) submission category"

    return [pscustomobject]@{
        Key      = [string]$Entry.key
        Action   = "SubmittedOriginal"
        Mutated  = $true
        Id       = [string]$result.id
        Status   = [string]$result.status
        Category = [string]$result.category
        Message  = "Submitted exactly one original locale. Wait for APPROVED/UTILITY before cleanup."
    }
}

function Remove-ProofEntry {
    param(
        [object]$Entry
    )

    $encodedName = [Uri]::EscapeDataString([string]$Entry.proof.name)
    $deletePath = "$($script:Plan.canadaWabaId)/message_templates?name=$encodedName&hsm_id=$($Entry.proof.id)"
    $result = Invoke-MetaRequest -Method DELETE -Path $deletePath -Body $null
    if (-not [bool]$result.success) {
        throw "Meta did not confirm deletion of proof $($Entry.proof.id)."
    }

    $remaining = @(
        Get-LiveTemplatesByName -Name ([string]$Entry.proof.name) |
            Where-Object { $_.id -ceq [string]$Entry.proof.id }
    )
    if ($remaining.Count -ne 0) {
        throw "Proof $($Entry.proof.id) still appears in the live inventory after deletion."
    }

    return [pscustomobject]@{
        Key     = [string]$Entry.key
        Action  = "DeletedProof"
        Mutated = $true
        ProofId = [string]$Entry.proof.id
        Deleted = $true
        Message = "Deleted only the proof after its exact original locale was APPROVED/UTILITY."
    }
}

function Invoke-RecreateOriginal {
    Assert-CooldownComplete
    Assert-ProtectedProductionVariants
    $entry = Get-SelectedEntry
    $existing = Get-OriginalTargetVariant -Entry $entry

    if ($null -ne $existing) {
        $existing = Assert-OriginalApprovedUtility -Entry $entry -Original $existing
        return [pscustomobject]@{
            Key      = [string]$entry.key
            Action   = "AlreadyApproved"
            Mutated  = $false
            Id       = [string]$existing.id
            Status   = [string]$existing.status
            Category = [string]$existing.category
            Message  = "The exact original locale is already live and approved as Utility."
        }
    }

    [void](Assert-LiveProof -Entry $entry)
    return Submit-OriginalEntry -Entry $entry
}

function Invoke-CleanupProof {
    Assert-CooldownComplete
    Assert-ProtectedProductionVariants
    $entry = Get-SelectedEntry
    $original = Get-OriginalTargetVariant -Entry $entry

    if ($null -eq $original) {
        throw "$($entry.originalTemplateName)/$($entry.targetLanguage) is missing. Proof cleanup is refused."
    }
    [void](Assert-OriginalApprovedUtility -Entry $entry -Original $original)

    $proof = Get-LiveProofOrNull -Entry $entry
    if ($null -eq $proof) {
        return [pscustomobject]@{
            Key     = [string]$entry.key
            Action  = "AlreadyClean"
            Mutated = $false
            ProofId = [string]$entry.proof.id
            Deleted = $true
            Message = "The proof is already absent and the original is APPROVED/UTILITY."
        }
    }

    [void](Assert-LiveProofObject -Entry $entry -Live $proof)
    return Remove-ProofEntry -Entry $entry
}

function Invoke-Auto {
    Assert-CooldownComplete
    Assert-ProtectedProductionVariants

    foreach ($entry in @($script:Plan.entries)) {
        $proof = Get-LiveProofOrNull -Entry $entry
        if ($null -ne $proof) {
            $proof = Assert-LiveProofObject -Entry $entry -Live $proof
        }

        $original = Get-OriginalTargetVariant -Entry $entry
        if ($null -eq $original) {
            if ($null -eq $proof) {
                throw "$($entry.key) has neither a proof nor a recreated original."
            }
            return Submit-OriginalEntry -Entry $entry
        }

        if ([string]$original.category -ceq "MARKETING") {
            throw "$($entry.originalTemplateName)/$($entry.targetLanguage) is MARKETING. Auto mode is stopped."
        }
        Assert-Equal -Actual $original.category -Expected "UTILITY" -Label "$($entry.key) auto original category"
        Assert-Components -Entry $entry -Components @($original.components)

        if ([string]$original.status -ceq "PENDING") {
            return [pscustomobject]@{
                Key      = [string]$entry.key
                Action   = "WaitingForApproval"
                Mutated  = $false
                Id       = [string]$original.id
                Status   = [string]$original.status
                Category = [string]$original.category
                Message  = "Meta review is pending. Run this same script again later."
            }
        }
        if ([string]$original.status -cne "APPROVED") {
            throw "$($entry.originalTemplateName)/$($entry.targetLanguage) status is '$($original.status)'. Auto mode is stopped."
        }

        if ($null -ne $proof) {
            return Remove-ProofEntry -Entry $entry
        }
    }

    return [pscustomobject]@{
        Key     = "all"
        Action  = "Complete"
        Mutated = $false
        Complete = $true
        Message = "All four originals are APPROVED/UTILITY with exact components, and all four proofs are absent."
    }
}

$script:Plan = Read-Plan
Assert-Plan -Plan $script:Plan

if ($Mode -ceq "Validate") {
    [pscustomobject]@{
        Valid             = $true
        EntryCount        = @($script:Plan.entries).Count
        CanadaWabaId      = [string]$script:Plan.canadaWabaId
        GraphApiVersion   = [string]$script:Plan.graphApiVersion
        SafeNotBeforeUtc  = [string]$script:Plan.safeNotBeforeUtc
        TokenRequired     = $false
    }
    return
}

if ($Mode -in @("Auto", "RecreateOriginals", "CleanupProofs")) {
    Assert-CooldownComplete
}

$script:MetaToken = Get-SecretToken
if ([string]::IsNullOrWhiteSpace($script:MetaToken)) {
    throw "A non-empty Meta access token is required."
}

switch ($Mode) {
    "Auto" {
        Invoke-Auto
    }
    "Status" {
        Invoke-Status
    }
    "RecreateOriginals" {
        Invoke-RecreateOriginal
    }
    "CleanupProofs" {
        Invoke-CleanupProof
    }
}
