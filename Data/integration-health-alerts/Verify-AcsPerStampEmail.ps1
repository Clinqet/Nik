#Requires -Modules Az.Accounts
<#
.SYNOPSIS
    Proves (or disproves) that a SECOND Azure Communication Services stack can be stood up for the India
    stamp using the SAME verified email domain, so email delivery reports can be routed per region.

.DESCRIPTION
    Answers every question with real Azure calls, never with an assumption:

      V1  Can the SAME custom domain be provisioned in a SECOND Email Communication Service in this
          subscription, and does Azure issue its own separate TXT verification record?
      V2  Is "India" accepted as the Data Location for an Email Communication Service?
      V3  Does this subscription expose the Event Grid topic type
          "Microsoft.Communication.CommunicationServices", i.e. can ACS be an Event Grid source at all?
      V4  Is "India" accepted as the Data Location for a COMMUNICATION Service (the resource that actually
          sends, and that the Event Grid system topic hangs off)?
      V5  Can an Event Grid system topic be created against that Communication Service?

    V3 runs in -Step check and is entirely read-only.
    V1 and V2 need -Step probe; V4 and V5 need -Step link. Both CREATE throwaway resources whose names end
    in the probe suffix. -Step cleanup deletes exactly those and refuses to touch anything else.

    Nothing here changes an existing resource. No DNS record is written. No email is sent.

.PARAMETER Step
    check    Read-only inventory + V3. Start here. Creates nothing.
    probe    Creates the probe Email Communication Service and adds the domain. Answers V2 then V1.
    link     Creates the probe Communication Service and a system topic on it. Answers V4 then V5.
    prove    THE FULL END-TO-END PROOF. Creates the India pair, writes ONE extra TXT value into the
             existing record set in Azure DNS, drives all four verifications to Verified, links the
             domain, and sends one real test email from the second resource. Needs -TestEmailTo.
    cost     Read-only, no Azure login: every billable meter from Azure's public Retail Prices API.
    spend    Read-only: what this subscription was ACTUALLY billed for the communication resource
             group last month, from Cost Management. The definitive answer on standing charges.
    cleanup  Deletes only the resources whose name ends in -ProbeSuffix, and removes the one TXT value
             that -Step prove added. Never touches anything it did not create.

.PARAMETER ResourceGroup
    The resource group holding the Communication Services resources. Matches deploy.ps1's
    $CommunicationResourceGroup, default "communication".

.PARAMETER Domain
    The custom email domain to re-provision, e.g. clinket.com or dev.clinket.com. Omit to auto-detect the
    single domain already provisioned under the existing Email Communication Service.

.PARAMETER DataLocation
    Data Location for the probe Email Communication Service. "India" is what we want to prove.

.EXAMPLE
    ./Verify-AcsPerStampEmail.ps1 -Step cost
    ./Verify-AcsPerStampEmail.ps1 -Step spend
    ./Verify-AcsPerStampEmail.ps1 -Step prove -TestEmailTo you@example.com
    ./Verify-AcsPerStampEmail.ps1 -Step cleanup

.NOTES
    Run in Azure Cloud Shell (switch it to PowerShell) or any shell with the Az module and
    Connect-AzAccount already done. Confirm the subscription the header prints before answering a prompt.
#>
[CmdletBinding()]
param(
    [ValidateSet('check', 'probe', 'link', 'prove', 'cost', 'spend', 'cleanup')]
    [string]$Step = 'check',

    # -Step prove only: where the one real test email is sent. Required for that step.
    [string]$TestEmailTo = '',

    # -Step prove only: the Azure DNS zone holding the mail domain, and its resource group.
    # Empty auto-discovers the longest-suffix zone match in this subscription.
    [string]$DnsZoneName = '',
    [string]$DnsResourceGroup = '',

    [string]$ResourceGroup = 'communication',

    [string]$Domain = '',

    [string]$DataLocation = 'India',

    [string]$ProbeSuffix = '-inprobe',

    [string]$CommunicationApiVersion = '2023-04-01',

    [string]$EventGridApiVersion = '2025-02-15'
)

$ErrorActionPreference = 'Stop'

function Write-Head([string]$text) {
    Write-Host ''
    Write-Host ("=" * 78) -ForegroundColor DarkCyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host ("=" * 78) -ForegroundColor DarkCyan
}

function Write-Pass([string]$text) { Write-Host "  [PASS] $text" -ForegroundColor Green }

function Write-Fail([string]$text) { Write-Host "  [FAIL] $text" -ForegroundColor Red }
function Write-Info([string]$text) { Write-Host "  [INFO] $text" -ForegroundColor Gray }
function Write-Warn([string]$text) { Write-Host "  [WARN] $text" -ForegroundColor Yellow }

# ACS returns a record name as an FQDN; Azure DNS wants it relative to the zone ("@" at the apex).
function Get-RelativeDnsName {
    param([string]$RecordName, [string]$ZoneName)
    $name = $RecordName.TrimEnd(".")
    $zone = $ZoneName.TrimEnd(".")
    if ($name -eq $zone) { return "@" }
    if ($name.EndsWith(".$zone", [System.StringComparison]::OrdinalIgnoreCase)) {
        return $name.Substring(0, $name.Length - $zone.Length - 1)
    }
    return $name
}

# The Azure DNS zone in this subscription that hosts $Domain - the longest suffix match wins, so
# "dev.clinket.com" prefers its own zone over the "clinket.com" apex when both exist.
function Resolve-DnsZoneForDomain {
    param([string]$MailDomain)
    $zones = @(Get-AzDnsZone -ErrorAction SilentlyContinue |
        Where-Object { $MailDomain -eq $_.Name -or $MailDomain.EndsWith(".$($_.Name)", [System.StringComparison]::OrdinalIgnoreCase) } |
        Sort-Object { $_.Name.Length } -Descending)
    if ($zones.Count -eq 0) { return $null }
    return [pscustomobject]@{ Name = $zones[0].Name; ResourceGroup = $zones[0].ResourceGroupName }
}

# Every ARM call goes through here so a failure prints the body Azure actually returned, which is the
# only thing that distinguishes "not supported" from "you typed it wrong".
function Invoke-Arm {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$Method = 'GET',
        [string]$Payload = $null,
        [switch]$AllowFailure
    )
    $parameters = @{ Path = $Path; Method = $Method }
    if ($Payload) { $parameters['Payload'] = $Payload }

    try {
        $response = Invoke-AzRestMethod @parameters
    }
    catch {
        if ($AllowFailure) {
            return [pscustomobject]@{ StatusCode = 0; Content = $_.Exception.Message; Object = $null }
        }
        throw
    }

    $object = $null
    if ($response.Content) {
        try { $object = $response.Content | ConvertFrom-Json } catch { $object = $null }
    }
    return [pscustomobject]@{ StatusCode = $response.StatusCode; Content = $response.Content; Object = $object }
}

# -----------------------------------------------------------------------------
#  cost - Azure's OWN public retail price list, not a blog and not a guess.
#  A standing/monthly charge would appear here as a meter whose unitOfMeasure is time-based
#  ("1 Hour", "1/Month") rather than consumption-based ("1K Emails", "1M Operations").
#  No Azure login is needed for this step; the Retail Prices API is public.
# -----------------------------------------------------------------------------
if ($Step -eq 'cost') {
    foreach ($service in @('Azure Communication Services', 'Event Grid')) {
        Write-Head "Billable meters for '$service' (Azure Retail Prices API, currency USD)"

        $meters = @()
        $next = "https://prices.azure.com/api/retail/prices?currencyCode='USD'&`$filter=serviceName eq '$service'"
        $pages = 0
        while ($next -and $pages -lt 20) {
            try { $page = Invoke-RestMethod -Method GET -Uri $next -ErrorAction Stop }
            catch {
                Write-Fail "Could not reach the Retail Prices API: $($_.Exception.Message)"
                $next = $null
                break
            }
            $meters += @($page.Items)
            $next = $page.NextPageLink
            $pages++
        }

        if ($meters.Count -eq 0) {
            Write-Warn "No meters returned for '$service'."
            continue
        }

        # EVERY tier row, not the first: tiered pricing starts with a 0-priced free band, and showing only
        # that band makes a paid meter look free.
        $meters |
            Select-Object -Property productName, skuName, meterName, unitOfMeasure, tierMinimumUnits, retailPrice |
            Sort-Object productName, meterName, tierMinimumUnits |
            Group-Object productName, meterName, unitOfMeasure, tierMinimumUnits, retailPrice |
            ForEach-Object {
                $row = $_.Group[0]
                Write-Host ("  {0,-34} {1,-34} {2,-12} from {3,-10} = {4}" -f `
                        $row.productName, $row.meterName, $row.unitOfMeasure, $row.tierMinimumUnits, $row.retailPrice) -ForegroundColor White
            }

        $timeBased = @($meters | Where-Object { $_.unitOfMeasure -match 'Hour|Month|Day' })
        if ($timeBased.Count -eq 0) {
            Write-Pass "No time-based meter exists for '$service' - nothing is charged for simply having the resource."
        }
        else {
            Write-Warn "Time-based meters exist for '$service'. Check which PRODUCT they belong to before assuming they apply:"
            $timeBased | Select-Object productName, meterName, unitOfMeasure, retailPrice -Unique |
                ForEach-Object { Write-Host "    [$($_.productName)] $($_.meterName) - $($_.retailPrice) per $($_.unitOfMeasure)" -ForegroundColor Yellow }
            Write-Info "For Event Grid, 'Throughput Unit' belongs to NAMESPACES (standard tier). A system topic"
            Write-Info "pushing to a Service Bus queue is BASIC tier, which has no throughput units at all -"
            Write-Info "Microsoft's tier comparison lists 'Subscribe to Azure system events' and 'Push delivery to"
            Write-Info "Azure services (Service Bus queues)' as basic-only, and 'Autoscale (TU adjustment)' as standard-only."
        }

        Write-Info "Rows returned: $($meters.Count)."
    }

    Write-Head '!! Azure Communication Services is NOT in the Retail Prices API'
    Write-Host "  Zero rows come back for ACS by serviceName, productName or serviceFamily. That is an ABSENCE" -ForegroundColor Yellow
    Write-Host "  of data, not evidence of being free - this API simply does not publish ACS meters." -ForegroundColor Yellow
    Write-Host '  The documented ACS email price is $0.00025/email + $0.00012/MB with no listed standing charge.' -ForegroundColor White
    Write-Host "  To settle it from YOUR OWN bill instead of a document, run:" -ForegroundColor White
    Write-Host "      ./Verify-AcsPerStampEmail.ps1 -Step spend" -ForegroundColor Yellow
    return
}

# -----------------------------------------------------------------------------
#  spend - the definitive answer, from this subscription's OWN invoice data.
#  You already run one Communication Service and one Email Communication Service. If either carried a
#  standing charge, it would already appear here as a meter unrelated to email volume.
# -----------------------------------------------------------------------------
if ($Step -eq 'spend') {
    $spendContext = Get-AzContext
    if (-not $spendContext) { throw 'No Azure context. Run Connect-AzAccount first.' }
    $spendSubscription = $spendContext.Subscription.Id

    # Which timeframes a subscription accepts depends on its billing account type - this one rejects
    # TheLastMonth. Custom with an explicit window is accepted everywhere, so it leads.
    $windowStart = (Get-Date).ToUniversalTime().AddDays(-60).ToString('yyyy-MM-ddT00:00:00+00:00')
    $windowEnd = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddT23:59:59+00:00')

    $attempts = @(
        @{ Label = "the last 60 days"; Timeframe = 'Custom'; TimePeriod = @{ from = $windowStart; to = $windowEnd } },
        @{ Label = "this month so far"; Timeframe = 'MonthToDate'; TimePeriod = $null },
        @{ Label = "the last billing month"; Timeframe = 'TheLastBillingMonth'; TimePeriod = $null }
    )

    # Cost Management throttles hard and answers 429 to a burst. Space the attempts out rather than
    # hammering it, and honour a Retry-After when one comes back.
    $succeeded = $false
    $isFirstAttempt = $true
    foreach ($apiVersion in @('2023-11-01', '2021-10-01')) {
        foreach ($attempt in $attempts) {
            if (-not $isFirstAttempt) {
                Write-Info 'Pausing 20s so Cost Management does not throttle the next query...'
                Start-Sleep -Seconds 20
            }
            $isFirstAttempt = $false
            $dataset = @{
                granularity = 'None'
                aggregation = @{ totalCost = @{ name = 'Cost'; function = 'Sum' } }
                grouping    = @(
                    @{ type = 'Dimension'; name = 'ResourceId' },
                    @{ type = 'Dimension'; name = 'Meter' }
                )
            }
            $query = @{ type = 'ActualCost'; timeframe = $attempt.Timeframe; dataset = $dataset }
            if ($attempt.TimePeriod) { $query['timePeriod'] = $attempt.TimePeriod }
            $queryBody = $query | ConvertTo-Json -Depth 8

            Write-Head "Cost for resource group '$ResourceGroup' over $($attempt.Label) (api-version $apiVersion)"

            $path = "/subscriptions/$spendSubscription/resourceGroups/$ResourceGroup/providers/Microsoft.CostManagement/query?api-version=$apiVersion"
            $result = Invoke-Arm -Path $path -Method 'POST' -Payload $queryBody -AllowFailure

            # A 429 says nothing about the timeframe - retry the SAME query after a wait instead of
            # moving on and blaming a timeframe that was never tried.
            $throttleWaits = 0
            while ($result.StatusCode -eq 429 -and $throttleWaits -lt 3) {
                $throttleWaits++
                Write-Warn "Cost Management throttled the query (429). Waiting 60s, attempt $throttleWaits of 3..."
                Start-Sleep -Seconds 60
                $result = Invoke-Arm -Path $path -Method 'POST' -Payload $queryBody -AllowFailure
            }

            if ($result.StatusCode -ne 200) {
                Write-Warn "HTTP $($result.StatusCode) - trying the next timeframe."
                Write-Info $result.Content
                continue
            }
            $succeeded = $true

            $columns = @($result.Object.properties.columns.name)
            $rows = @($result.Object.properties.rows)
            if ($rows.Count -eq 0) {
                Write-Pass "No cost rows at all for '$ResourceGroup' over $($attempt.Label)."
                Write-Info 'Nothing was billed against the Communication Services resources in that window.'
                Write-Info 'An idle Communication Service and Email Communication Service cost nothing.'
                return
            }

            $costIndex = [array]::IndexOf($columns, 'Cost')
            $resourceIndex = [array]::IndexOf($columns, 'ResourceId')
            $meterIndex = [array]::IndexOf($columns, 'Meter')
            $currencyIndex = [array]::IndexOf($columns, 'Currency')

            foreach ($row in $rows) {
                $resource = if ($resourceIndex -ge 0) { ($row[$resourceIndex] -split '/')[-1] } else { '(unknown)' }
                $meter = if ($meterIndex -ge 0) { $row[$meterIndex] } else { '(unknown)' }
                $cost = if ($costIndex -ge 0) { $row[$costIndex] } else { 0 }
                $currency = if ($currencyIndex -ge 0) { $row[$currencyIndex] } else { '' }
                Write-Host ("  {0,-46} {1,-40} {2} {3}" -f $resource, $meter, $cost, $currency) -ForegroundColor White
            }

            Write-Head 'How to read this'
            Write-Host "  Every meter above is one you were actually charged for. A standing charge would show as" -ForegroundColor White
            Write-Host "  a meter unrelated to email volume, billed even in a quiet window." -ForegroundColor White
            Write-Host "  If the only meters are email/data ones, a second resource pair adds nothing: the same" -ForegroundColor White
            Write-Host "  total volume is simply split across two resources." -ForegroundColor White
            return
        }
    }

    if (-not $succeeded) {
        Write-Fail 'Cost Management refused every timeframe on every api-version.'
        Write-Info 'Check that this identity has Cost Management Reader on the subscription, then retry.'
    }
    return
}

$context = Get-AzContext
if (-not $context) { throw 'No Azure context. Run Connect-AzAccount first.' }
$subscriptionId = $context.Subscription.Id

Write-Head 'Context'
Write-Host "  Subscription : $($context.Subscription.Name)  ($subscriptionId)" -ForegroundColor White
Write-Host "  Tenant       : $($context.Tenant.Id)" -ForegroundColor White
Write-Host "  Account      : $($context.Account.Id)" -ForegroundColor White
Write-Host "  Resource grp : $ResourceGroup" -ForegroundColor White
Write-Host "  Step         : $Step" -ForegroundColor White

$armBase = "/subscriptions/$subscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.Communication"

# -----------------------------------------------------------------------------
#  Inventory - what exists right now
# -----------------------------------------------------------------------------
Write-Head 'Existing Communication Services inventory (read-only)'

$emailServicesResponse = Invoke-Arm -Path "$armBase/emailServices?api-version=$CommunicationApiVersion" -AllowFailure
if ($emailServicesResponse.StatusCode -ne 200) {
    Write-Fail "Could not list emailServices in '$ResourceGroup' (HTTP $($emailServicesResponse.StatusCode))."
    Write-Info $emailServicesResponse.Content
    return
}

$emailServices = @($emailServicesResponse.Object.value)
if ($emailServices.Count -eq 0) {
    Write-Fail "No Email Communication Service exists in '$ResourceGroup'. Nothing to compare against."
    return
}

foreach ($service in $emailServices) {
    Write-Host "  emailServices/$($service.name)" -ForegroundColor White
    Write-Host "      dataLocation      : $($service.properties.dataLocation)" -ForegroundColor Gray
    Write-Host "      provisioningState : $($service.properties.provisioningState)" -ForegroundColor Gray
}

$communicationServicesResponse = Invoke-Arm -Path "$armBase/communicationServices?api-version=$CommunicationApiVersion" -AllowFailure
foreach ($service in @($communicationServicesResponse.Object.value)) {
    Write-Host "  communicationServices/$($service.name)" -ForegroundColor White
    Write-Host "      dataLocation  : $($service.properties.dataLocation)" -ForegroundColor Gray
    Write-Host "      linkedDomains : $(if ($service.properties.linkedDomains) { ($service.properties.linkedDomains | ForEach-Object { $_.Split('/')[-1] }) -join ', ' } else { '(none)' })" -ForegroundColor Gray
}

# The probe must never reuse an existing service. Pick the first non-probe one as the reference.
$existingEmailService = @($emailServices | Where-Object { -not $_.name.EndsWith($ProbeSuffix) })[0]
if (-not $existingEmailService) {
    Write-Fail "Every emailServices resource ends in '$ProbeSuffix'. Refusing to treat a probe as the reference."
    return
}
Write-Info "Reference Email Communication Service: $($existingEmailService.name)"

$domainsResponse = Invoke-Arm -Path "$armBase/emailServices/$($existingEmailService.name)/domains?api-version=$CommunicationApiVersion" -AllowFailure
$existingDomains = @($domainsResponse.Object.value)

Write-Host ''
Write-Host "  Domains under $($existingEmailService.name):" -ForegroundColor White
foreach ($existing in $existingDomains) {
    $states = $existing.properties.verificationStates
    Write-Host "    $($existing.name)" -ForegroundColor White
    Write-Host "        domainManagement : $($existing.properties.domainManagement)" -ForegroundColor Gray
    Write-Host "        Domain / SPF / DKIM / DKIM2 : $($states.Domain.status) / $($states.SPF.status) / $($states.DKIM.status) / $($states.DKIM2.status)" -ForegroundColor Gray
    if ($existing.properties.verificationRecords.Domain) {
        Write-Host "        Domain TXT : $($existing.properties.verificationRecords.Domain.name) = $($existing.properties.verificationRecords.Domain.value)" -ForegroundColor DarkGray
    }
}

if (-not $Domain) {
    $customerManaged = @($existingDomains | Where-Object { $_.properties.domainManagement -eq 'CustomerManaged' })
    if ($customerManaged.Count -eq 1) {
        $Domain = $customerManaged[0].name
        Write-Info "Auto-detected domain to re-provision: $Domain"
    }
    elseif ($customerManaged.Count -eq 0) {
        Write-Fail 'No CustomerManaged domain found. Pass -Domain explicitly.'
        return
    }
    else {
        Write-Fail "More than one CustomerManaged domain ($($customerManaged.name -join ', ')). Pass -Domain explicitly."
        return
    }
}

$referenceDomain = @($existingDomains | Where-Object { $_.name -eq $Domain })[0]
$probeEmailServiceName = "$($existingEmailService.name)$ProbeSuffix"
$probeDomainPath = "$armBase/emailServices/$probeEmailServiceName/domains/$Domain"

$existingCommunicationService = @($communicationServicesResponse.Object.value | Where-Object { -not $_.name.EndsWith($ProbeSuffix) })[0]
$probeCommunicationServiceName = if ($existingCommunicationService) { "$($existingCommunicationService.name)$ProbeSuffix" } else { "clinket-communication$ProbeSuffix" }
$probeTopicName = "$probeCommunicationServiceName-events"
$eventGridBase = "/subscriptions/$subscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.EventGrid"

# -----------------------------------------------------------------------------
#  V3 - read-only: is ACS a usable Event Grid source in this subscription?
# -----------------------------------------------------------------------------
if ($Step -eq 'check') {
    Write-Head 'V3  Event Grid topic type for Azure Communication Services (read-only)'

    $topicTypesResponse = Invoke-Arm -Path "/providers/Microsoft.EventGrid/topicTypes?api-version=$EventGridApiVersion" -AllowFailure
    if ($topicTypesResponse.StatusCode -ne 200) {
        Write-Fail "Could not list Event Grid topic types (HTTP $($topicTypesResponse.StatusCode))."
        Write-Info $topicTypesResponse.Content
    }
    else {
        $acsTopicType = @($topicTypesResponse.Object.value | Where-Object { $_.name -eq 'Microsoft.Communication.CommunicationServices' })[0]
        if ($acsTopicType) {
            Write-Pass "Topic type 'Microsoft.Communication.CommunicationServices' is available."
            Write-Info "provisioningState: $($acsTopicType.properties.provisioningState); sourceResourceFormat: $($acsTopicType.properties.sourceResourceFormat)"

            $eventTypesResponse = Invoke-Arm -Path "/providers/Microsoft.EventGrid/topicTypes/Microsoft.Communication.CommunicationServices/eventTypes?api-version=$EventGridApiVersion" -AllowFailure
            $emailEventType = @($eventTypesResponse.Object.value | Where-Object { $_.name -eq 'Microsoft.Communication.EmailDeliveryReportReceived' })[0]
            if ($emailEventType) {
                Write-Pass "Event type 'Microsoft.Communication.EmailDeliveryReportReceived' is published by this topic type."
            }
            else {
                Write-Warn "EmailDeliveryReportReceived was not listed. Event types returned: $((@($eventTypesResponse.Object.value).name) -join ', ')"
            }
        }
        else {
            Write-Fail "Topic type 'Microsoft.Communication.CommunicationServices' was NOT found in this subscription."
        }
    }

    Write-Head 'Next steps'
    Write-Host "  Run:  ./Verify-AcsPerStampEmail.ps1 -Step probe   (V1 + V2)" -ForegroundColor White
    Write-Host "  Then: ./Verify-AcsPerStampEmail.ps1 -Step link    (V4 + V5)" -ForegroundColor White
    Write-Host "  That CREATES two throwaway resources:" -ForegroundColor White
    Write-Host "      emailServices/$probeEmailServiceName            (dataLocation $DataLocation)" -ForegroundColor Gray
    Write-Host "      emailServices/$probeEmailServiceName/domains/$Domain" -ForegroundColor Gray
    Write-Host "  Neither sends mail, neither touches DNS, and -Step cleanup removes exactly those two." -ForegroundColor White
    return
}

# -----------------------------------------------------------------------------
#  cleanup - deletes ONLY names ending in the probe suffix
# -----------------------------------------------------------------------------
if ($Step -eq 'link') {
    Write-Head "V4  Is '$DataLocation' accepted as a COMMUNICATION Service Data Location?"

    $communicationBody = @{
        location   = 'global'
        properties = @{ dataLocation = $DataLocation }
    } | ConvertTo-Json -Depth 5

    $createCommunication = Invoke-Arm -Path "$armBase/communicationServices/${probeCommunicationServiceName}?api-version=$CommunicationApiVersion" `
        -Method 'PUT' -Payload $communicationBody -AllowFailure

    if ($createCommunication.StatusCode -notin @(200, 201)) {
        Write-Fail "V4 FAILED - Azure refused a Communication Service with dataLocation '$DataLocation' (HTTP $($createCommunication.StatusCode))."
        Write-Host "  Azure said:" -ForegroundColor Yellow
        Write-Host "  $($createCommunication.Content)" -ForegroundColor Yellow
        Write-Host "  Re-run with -DataLocation 'United States' to see whether the geography is the reason." -ForegroundColor Yellow
        return
    }

    Write-Pass "V4 PASSED - Communication Service accepted dataLocation '$DataLocation' (HTTP $($createCommunication.StatusCode))."

    $communicationReady = $false
    $probeCommunicationId = $null
    for ($waited = 0; $waited -lt 180; $waited += 10) {
        $state = Invoke-Arm -Path "$armBase/communicationServices/${probeCommunicationServiceName}?api-version=$CommunicationApiVersion" -AllowFailure
        if ($state.StatusCode -eq 200 -and $state.Object.properties.provisioningState -eq 'Succeeded') {
            $communicationReady = $true
            $probeCommunicationId = $state.Object.id
            Write-Pass "Probe Communication Service provisioned (dataLocation $($state.Object.properties.dataLocation))."
            break
        }
        Start-Sleep -Seconds 10
        Write-Info "Waiting for provisioning ($waited s): $($state.Object.properties.provisioningState)"
    }

    if (-not $communicationReady) {
        Write-Fail 'Probe Communication Service did not reach Succeeded within 180s.'
        Write-Warn 'Run -Step cleanup before retrying.'
        return
    }

    Write-Head 'V5  Can an Event Grid system topic be created against it?'

    $topicBody = @{
        location   = 'global'
        properties = @{
            source    = $probeCommunicationId
            topicType = 'Microsoft.Communication.CommunicationServices'
        }
    } | ConvertTo-Json -Depth 5

    $createTopic = Invoke-Arm -Path "$eventGridBase/systemTopics/${probeTopicName}?api-version=$EventGridApiVersion" `
        -Method 'PUT' -Payload $topicBody -AllowFailure

    if ($createTopic.StatusCode -notin @(200, 201)) {
        Write-Fail "V5 FAILED - the system topic was refused (HTTP $($createTopic.StatusCode))."
        Write-Host "  Azure said:" -ForegroundColor Yellow
        Write-Host "  $($createTopic.Content)" -ForegroundColor Yellow
        Write-Warn 'Run -Step cleanup to remove the probe Communication Service.'
        return
    }

    Write-Pass "V5 PASSED - system topic '$probeTopicName' accepted (HTTP $($createTopic.StatusCode))."

    for ($waited = 0; $waited -lt 120; $waited += 10) {
        Start-Sleep -Seconds 10
        $topicState = Invoke-Arm -Path "$eventGridBase/systemTopics/${probeTopicName}?api-version=$EventGridApiVersion" -AllowFailure
        if ($topicState.StatusCode -eq 200 -and $topicState.Object.properties.provisioningState -eq 'Succeeded') {
            Write-Pass "System topic provisioned at location '$($topicState.Object.location)' with topicType '$($topicState.Object.properties.topicType)'."
            break
        }
        Write-Info "Waiting for topic provisioning ($waited s): $($topicState.Object.properties.provisioningState)"
    }

    Write-Head 'Verdict'
    Write-Host "  V4 (Communication Service in '$DataLocation') : PASS" -ForegroundColor White
    Write-Host "  V5 (Event Grid system topic on it)            : PASS" -ForegroundColor White
    Write-Host ''
    Write-Host "  The probe domain is unverified, so the probe still cannot send mail and the topic will never" -ForegroundColor White
    Write-Host "  emit an event. Domain linking is deliberately NOT attempted - Azure only permits it after DNS" -ForegroundColor White
    Write-Host "  verification, which deploy.ps1 already performs for the live domain." -ForegroundColor White
    Write-Host ''
    Write-Host "  Now run:  ./Verify-AcsPerStampEmail.ps1 -Step cleanup" -ForegroundColor Yellow
    return
}

# -----------------------------------------------------------------------------
#  prove - the full end-to-end proof. Creates the pair, writes ONE extra TXT VALUE into the existing
#  record set (never replaces it), drives all four verifications to Verified, links the domain, and sends
#  one real email from the second resource. Cleanup removes the resources AND that one TXT value.
# -----------------------------------------------------------------------------
if ($Step -eq 'prove') {
    if ([string]::IsNullOrWhiteSpace($TestEmailTo)) {
        Write-Fail 'Pass -TestEmailTo <address>. This step sends one real email and will not guess a recipient.'
        return
    }
    if (-not (Get-Module -ListAvailable -Name Az.Dns)) {
        Write-Fail 'The Az.Dns module is required to write the verification record. Install-Module Az.Dns, or run this in Cloud Shell.'
        return
    }

    Write-Head 'Step 1 of 6 - the India Email Communication Service and the second copy of the domain'

    $emailServiceBody = @{ location = 'global'; properties = @{ dataLocation = $DataLocation } } | ConvertTo-Json -Depth 5
    $createService = Invoke-Arm -Path "$armBase/emailServices/${probeEmailServiceName}?api-version=$CommunicationApiVersion" `
        -Method 'PUT' -Payload $emailServiceBody -AllowFailure
    if ($createService.StatusCode -notin @(200, 201)) {
        Write-Fail "Email Communication Service PUT failed (HTTP $($createService.StatusCode)): $($createService.Content)"
        return
    }
    # ARM answers the PUT before the resource exists. Adding the domain immediately returns
    # ParentResourceNotFound, so wait for Succeeded first.
    $serviceReady = $false
    for ($waited = 0; $waited -lt 240; $waited += 10) {
        $state = Invoke-Arm -Path "$armBase/emailServices/${probeEmailServiceName}?api-version=$CommunicationApiVersion" -AllowFailure
        if ($state.StatusCode -eq 200 -and $state.Object.properties.provisioningState -eq 'Succeeded') {
            $serviceReady = $true
            break
        }
        Start-Sleep -Seconds 10
        Write-Info "Waiting for the Email Communication Service to provision ($waited s)..."
    }
    if (-not $serviceReady) {
        Write-Fail 'The Email Communication Service did not reach Succeeded within 240s. Run -Step cleanup and retry.'
        return
    }
    Write-Pass "Email Communication Service '$probeEmailServiceName' ($DataLocation) is ready."

    # userEngagementTracking matches the live domain, so the second copy behaves identically.
    $domainBody = @{
        location   = 'global'
        properties = @{ domainManagement = 'CustomerManaged'; userEngagementTracking = 'Enabled' }
    } | ConvertTo-Json -Depth 5
    $createDomain = Invoke-Arm -Path "${probeDomainPath}?api-version=$CommunicationApiVersion" `
        -Method 'PUT' -Payload $domainBody -AllowFailure
    if ($createDomain.StatusCode -notin @(200, 201)) {
        Write-Fail "Domain PUT failed (HTTP $($createDomain.StatusCode)): $($createDomain.Content)"
        return
    }

    $probeDomain = $null
    for ($waited = 0; $waited -lt 240; $waited += 10) {
        Start-Sleep -Seconds 10
        $state = Invoke-Arm -Path "${probeDomainPath}?api-version=$CommunicationApiVersion" -AllowFailure
        if ($state.StatusCode -eq 200) {
            $probeDomain = $state.Object
            if ($probeDomain.properties.provisioningState -eq 'Succeeded') { break }
        }
        Write-Info "Waiting for the domain to provision ($waited s)..."
    }
    if (-not $probeDomain -or $probeDomain.properties.provisioningState -ne 'Succeeded') {
        Write-Fail 'The second copy of the domain did not provision. Run -Step cleanup and retry.'
        return
    }
    $probeTxt = $probeDomain.properties.verificationRecords.Domain
    if (-not $probeTxt) {
        Write-Fail 'The second copy exposed no Domain verification record, so it can never verify.'
        return
    }
    Write-Pass "Second copy provisioned. Its own token: $($probeTxt.value)"

    Write-Head 'Step 2 of 6 - add that ONE value to the DNS record set (the existing values are untouched)'

    if ([string]::IsNullOrWhiteSpace($DnsZoneName)) {
        $zone = Resolve-DnsZoneForDomain -MailDomain $Domain
        if ($null -eq $zone) {
            Write-Fail "No Azure DNS zone in this subscription hosts '$Domain'. Pass -DnsZoneName and -DnsResourceGroup."
            return
        }
        $DnsZoneName = $zone.Name
        $DnsResourceGroup = $zone.ResourceGroup
    }
    Write-Info "Zone '$DnsZoneName' in resource group '$DnsResourceGroup'."

    $relativeName = Get-RelativeDnsName -RecordName $probeTxt.name -ZoneName $DnsZoneName

    $recordSet = Get-AzDnsRecordSet -ZoneName $DnsZoneName -ResourceGroupName $DnsResourceGroup `
        -Name $relativeName -RecordType TXT -ErrorAction SilentlyContinue
    if ($null -eq $recordSet) {
        Write-Fail "No TXT record set at '$relativeName' in '$DnsZoneName'. The live domain's own token should already be there - refusing to create one."
        return
    }

    $existingValues = @($recordSet.Records | ForEach-Object { $_.Value -join '' })
    Write-Info "TXT '$relativeName' currently holds $($existingValues.Count) value(s)."
    if ($existingValues -contains $probeTxt.value) {
        Write-Info 'The probe value is already present; nothing added.'
    }
    else {
        Add-AzDnsRecordConfig -RecordSet $recordSet -Value $probeTxt.value | Out-Null
        Set-AzDnsRecordSet -RecordSet $recordSet | Out-Null
        Write-Pass "Added ONE value. The record set now holds $($existingValues.Count + 1); every pre-existing value is intact."
    }

    Write-Head 'Step 3 of 6 - drive all four verifications to Verified'

    foreach ($verificationType in @('Domain', 'SPF', 'DKIM', 'DKIM2')) {
        $verifyBody = @{ verificationType = $verificationType } | ConvertTo-Json
        $verify = Invoke-Arm -Path "${probeDomainPath}/initiateVerification?api-version=$CommunicationApiVersion" `
            -Method 'POST' -Payload $verifyBody -AllowFailure
        if ($verify.StatusCode -ge 200 -and $verify.StatusCode -lt 300) { Write-Info "Initiated $verificationType." }
        elseif ($verify.StatusCode -eq 409) { Write-Info "$verificationType already in progress or complete." }
        else { Write-Warn "$verificationType returned HTTP $($verify.StatusCode): $($verify.Content)" }
    }

    $allVerified = $false
    for ($waited = 0; $waited -lt 900; $waited += 20) {
        Start-Sleep -Seconds 20
        $state = Invoke-Arm -Path "${probeDomainPath}?api-version=$CommunicationApiVersion" -AllowFailure
        if ($state.StatusCode -ne 200) { continue }
        $states = $state.Object.properties.verificationStates
        $summary = "Domain=$($states.Domain.status) SPF=$($states.SPF.status) DKIM=$($states.DKIM.status) DKIM2=$($states.DKIM2.status)"
        if ($states.Domain.status -eq 'Verified' -and $states.SPF.status -eq 'Verified' `
                -and $states.DKIM.status -eq 'Verified' -and $states.DKIM2.status -eq 'Verified') {
            Write-Pass "All four verified - $summary"
            $allVerified = $true
            break
        }
        Write-Info "Waiting ($waited s): $summary"
    }
    if (-not $allVerified) {
        Write-Fail 'Verification did not complete within 15 minutes. DNS propagation can be slower; re-run -Step prove to resume, or -Step cleanup to stop.'
        return
    }

    Write-Head 'Step 4 of 6 - sender username and the India Communication Service'

    $senderBody = @{ properties = @{ username = 'noreply'; displayName = 'Clinket' } } | ConvertTo-Json -Depth 3
    $sender = Invoke-Arm -Path "${probeDomainPath}/senderUsernames/noreply?api-version=$CommunicationApiVersion" `
        -Method 'PUT' -Payload $senderBody -AllowFailure
    if ($sender.StatusCode -in @(200, 201)) { Write-Pass "Sender noreply@$Domain created on the second copy." }
    elseif ($sender.StatusCode -eq 409) { Write-Info 'Sender already exists.' }
    else { Write-Warn "Sender PUT returned HTTP $($sender.StatusCode): $($sender.Content)" }

    $communicationBody = @{
        location   = 'global'
        properties = @{ dataLocation = $DataLocation; linkedDomains = @($probeDomainPath) }
    } | ConvertTo-Json -Depth 5
    $createCommunication = Invoke-Arm -Path "$armBase/communicationServices/${probeCommunicationServiceName}?api-version=$CommunicationApiVersion" `
        -Method 'PUT' -Payload $communicationBody -AllowFailure
    if ($createCommunication.StatusCode -notin @(200, 201)) {
        Write-Fail "Communication Service PUT (with the domain linked) failed (HTTP $($createCommunication.StatusCode)): $($createCommunication.Content)"
        return
    }

    $communicationEndpoint = $null
    for ($waited = 0; $waited -lt 240; $waited += 10) {
        Start-Sleep -Seconds 10
        $state = Invoke-Arm -Path "$armBase/communicationServices/${probeCommunicationServiceName}?api-version=$CommunicationApiVersion" -AllowFailure
        if ($state.StatusCode -eq 200 -and $state.Object.properties.provisioningState -eq 'Succeeded') {
            $communicationEndpoint = "https://$($state.Object.properties.hostName)"
            $linked = @($state.Object.properties.linkedDomains)
            Write-Pass "Communication Service provisioned. linkedDomains: $(($linked | ForEach-Object { $_.Split('/')[-1] }) -join ', ')"
            if ($linked.Count -eq 0) { Write-Fail 'The domain did NOT link. Sending cannot be proven.'; return }
            break
        }
        Write-Info "Waiting for the Communication Service ($waited s)..."
    }
    if (-not $communicationEndpoint) { Write-Fail 'The Communication Service did not provision.'; return }

    Write-Head 'Step 5 of 6 - send ONE real email from the India resource'

    $keys = Invoke-Arm -Path "$armBase/communicationServices/${probeCommunicationServiceName}/listKeys?api-version=$CommunicationApiVersion" `
        -Method 'POST' -AllowFailure
    if ($keys.StatusCode -ne 200) { Write-Fail "listKeys failed (HTTP $($keys.StatusCode))."; return }
    $accessKey = $keys.Object.primaryKey
    if ([string]::IsNullOrWhiteSpace($accessKey)) { Write-Fail 'listKeys returned no primary key.'; return }

    $sendBody = @{
        senderAddress = "noreply@$Domain"
        content       = @{
            subject   = "Clinket per-stamp email proof ($DataLocation)"
            plainText = "Sent from the $DataLocation Communication Service using the SAME domain as the live one. If you are reading this, one domain works in two Email Communication Services end to end."
        }
        recipients    = @{ to = @(@{ address = $TestEmailTo }) }
    } | ConvertTo-Json -Depth 6 -Compress

    $sendHost = ([Uri]$communicationEndpoint).Authority
    $pathAndQuery = '/emails:send?api-version=2023-03-31'
    $bodyBytes = [Text.Encoding]::UTF8.GetBytes($sendBody)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $contentHash = [Convert]::ToBase64String($sha.ComputeHash($bodyBytes)) } finally { $sha.Dispose() }
    $signedDate = [DateTimeOffset]::UtcNow.ToString('r', [Globalization.CultureInfo]::InvariantCulture)
    $stringToSign = "POST`n$pathAndQuery`n$signedDate;$sendHost;$contentHash"
    $hmac = [Security.Cryptography.HMACSHA256]::new([Convert]::FromBase64String($accessKey))
    try { $signature = [Convert]::ToBase64String($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($stringToSign))) }
    finally { $hmac.Dispose() }

    $sendHeaders = @{
        'x-ms-date'           = $signedDate
        'x-ms-content-sha256' = $contentHash
        'Authorization'       = "HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=$signature"
    }

    try {
        $sendResponse = Invoke-WebRequest -Method POST -Uri "$communicationEndpoint$pathAndQuery" `
            -Headers $sendHeaders -ContentType 'application/json' -Body $bodyBytes -ErrorAction Stop
        $operationId = $sendResponse.Headers['x-ms-request-id']
        Write-Pass "ACS accepted the send (HTTP $($sendResponse.StatusCode)). Body: $($sendResponse.Content)"
        $operationLocation = $sendResponse.Headers['Operation-Location']
        if ($operationLocation) { Write-Info "Operation-Location: $operationLocation" }
        if ($operationId) { Write-Info "Request id: $operationId" }
    }
    catch {
        Write-Fail "The send was refused: $($_.Exception.Message)"
        if ($_.ErrorDetails) { Write-Host "  $($_.ErrorDetails.Message)" -ForegroundColor Yellow }
        Write-Warn 'Run -Step cleanup to remove the probe resources and the added TXT value.'
        return
    }

    Write-Head 'Step 6 of 6 - verdict'
    Write-Host "  One domain, two Email Communication Services, both verified, both linked, and the SECOND one" -ForegroundColor White
    Write-Host "  just sent a real email from noreply@$Domain. Proven end to end against live Azure." -ForegroundColor White
    Write-Host ''
    Write-Host "  Check $TestEmailTo for the message, then run:" -ForegroundColor Yellow
    Write-Host "      ./Verify-AcsPerStampEmail.ps1 -Step cleanup" -ForegroundColor Yellow
    Write-Host "  Cleanup removes the probe resources AND the one TXT value this step added." -ForegroundColor White
    return
}

if ($Step -eq 'cleanup') {
    Write-Head 'Cleanup'

    # The TXT value first: it can only be identified while the probe domain still exists.
    $probeBeforeDelete = Invoke-Arm -Path "${probeDomainPath}?api-version=$CommunicationApiVersion" -AllowFailure
    $probeTxtValue = if ($probeBeforeDelete.StatusCode -eq 200) { $probeBeforeDelete.Object.properties.verificationRecords.Domain.value } else { $null }

    if ($probeTxtValue -and (Get-Module -ListAvailable -Name Az.Dns)) {
        if ([string]::IsNullOrWhiteSpace($DnsZoneName)) {
            $zone = Resolve-DnsZoneForDomain -MailDomain $Domain
            if ($null -ne $zone) { $DnsZoneName = $zone.Name; $DnsResourceGroup = $zone.ResourceGroup }
        }

        if (-not [string]::IsNullOrWhiteSpace($DnsZoneName)) {
            $relativeName = Get-RelativeDnsName -RecordName $probeBeforeDelete.Object.properties.verificationRecords.Domain.name -ZoneName $DnsZoneName
            $recordSet = Get-AzDnsRecordSet -ZoneName $DnsZoneName -ResourceGroupName $DnsResourceGroup `
                -Name $relativeName -RecordType TXT -ErrorAction SilentlyContinue
            $match = if ($recordSet) { @($recordSet.Records | Where-Object { ($_.Value -join '') -eq $probeTxtValue }) } else { @() }
            if ($match.Count -gt 0) {
                # ONLY the value this script added. Every other value in the set is left exactly as it was.
                Remove-AzDnsRecordConfig -RecordSet $recordSet -Value $probeTxtValue | Out-Null
                Set-AzDnsRecordSet -RecordSet $recordSet | Out-Null
                Write-Pass "Removed the probe TXT value from '$relativeName' in '$DnsZoneName'. $($recordSet.Records.Count) value(s) remain."
            }
            else {
                Write-Info 'The probe TXT value is not in the zone; nothing to remove.'
            }
        }
    }

    if (-not $probeEmailServiceName.EndsWith($ProbeSuffix)) {
        Write-Fail "Refusing to delete '$probeEmailServiceName' - it does not end in '$ProbeSuffix'."
        return
    }

    if ($probeTopicName.Contains($ProbeSuffix)) {
        $topicDelete = Invoke-Arm -Path "$eventGridBase/systemTopics/${probeTopicName}?api-version=$EventGridApiVersion" -Method 'DELETE' -AllowFailure
        if ($topicDelete.StatusCode -in @(200, 202, 204)) { Write-Pass "Deleted probe system topic $probeTopicName (HTTP $($topicDelete.StatusCode))." }
        elseif ($topicDelete.StatusCode -eq 404) { Write-Info 'Probe system topic was already absent.' }
        else { Write-Warn "Probe system topic delete returned HTTP $($topicDelete.StatusCode): $($topicDelete.Content)" }
    }

    if ($probeCommunicationServiceName.EndsWith($ProbeSuffix)) {
        $communicationDelete = Invoke-Arm -Path "$armBase/communicationServices/${probeCommunicationServiceName}?api-version=$CommunicationApiVersion" -Method 'DELETE' -AllowFailure
        if ($communicationDelete.StatusCode -in @(200, 202, 204)) { Write-Pass "Deleted probe Communication Service $probeCommunicationServiceName (HTTP $($communicationDelete.StatusCode))." }
        elseif ($communicationDelete.StatusCode -eq 404) { Write-Info 'Probe Communication Service was already absent.' }
        else { Write-Warn "Probe Communication Service delete returned HTTP $($communicationDelete.StatusCode): $($communicationDelete.Content)" }
    }

    $domainDelete = Invoke-Arm -Path "${probeDomainPath}?api-version=$CommunicationApiVersion" -Method 'DELETE' -AllowFailure
    if ($domainDelete.StatusCode -in @(200, 202, 204)) { Write-Pass "Deleted probe domain $Domain (HTTP $($domainDelete.StatusCode))." }
    elseif ($domainDelete.StatusCode -eq 404) { Write-Info 'Probe domain was already absent.' }
    else { Write-Warn "Probe domain delete returned HTTP $($domainDelete.StatusCode): $($domainDelete.Content)" }

    # ARM rejects deleting the parent while the child is still going away.
    for ($waited = 0; $waited -lt 120; $waited += 10) {
        Start-Sleep -Seconds 10
        $stillThere = Invoke-Arm -Path "${probeDomainPath}?api-version=$CommunicationApiVersion" -AllowFailure
        if ($stillThere.StatusCode -eq 404) { break }
        Write-Info "Waiting for the probe domain to finish deleting ($waited s)..."
    }

    $servicePath = "$armBase/emailServices/$probeEmailServiceName"
    $serviceDelete = Invoke-Arm -Path "${servicePath}?api-version=$CommunicationApiVersion" -Method 'DELETE' -AllowFailure
    if ($serviceDelete.StatusCode -in @(200, 202, 204)) { Write-Pass "Deleted probe Email Communication Service $probeEmailServiceName (HTTP $($serviceDelete.StatusCode))." }
    elseif ($serviceDelete.StatusCode -eq 404) { Write-Info 'Probe Email Communication Service was already absent.' }
    else { Write-Warn "Probe service delete returned HTTP $($serviceDelete.StatusCode): $($serviceDelete.Content)" }

    Write-Head 'Cleanup complete'
    Write-Info 'No DNS record was ever written, so nothing to remove from the zone.'
    return
}

# -----------------------------------------------------------------------------
#  probe - V2 then V1
# -----------------------------------------------------------------------------
Write-Head "V2  Is '$DataLocation' accepted as an Email Communication Service Data Location?"

Write-Info "Creating emailServices/$probeEmailServiceName with dataLocation '$DataLocation'..."
$emailServiceBody = @{
    location   = 'global'
    properties = @{ dataLocation = $DataLocation }
} | ConvertTo-Json -Depth 5

$createService = Invoke-Arm -Path "$armBase/emailServices/${probeEmailServiceName}?api-version=$CommunicationApiVersion" `
    -Method 'PUT' -Payload $emailServiceBody -AllowFailure

if ($createService.StatusCode -notin @(200, 201)) {
    Write-Fail "V2 FAILED - Azure refused dataLocation '$DataLocation' (HTTP $($createService.StatusCode))."
    Write-Host "  Azure said:" -ForegroundColor Yellow
    Write-Host "  $($createService.Content)" -ForegroundColor Yellow
    Write-Head 'Verdict'
    Write-Host "  V2 = FAIL. Re-run with -DataLocation 'United States' to test V1 independently." -ForegroundColor Red
    Write-Host "  Nothing was created, so no cleanup is needed." -ForegroundColor White
    return
}

Write-Pass "V2 PASSED - dataLocation '$DataLocation' accepted (HTTP $($createService.StatusCode))."

$serviceReady = $false
for ($waited = 0; $waited -lt 180; $waited += 10) {
    $state = Invoke-Arm -Path "$armBase/emailServices/${probeEmailServiceName}?api-version=$CommunicationApiVersion" -AllowFailure
    if ($state.StatusCode -eq 200 -and $state.Object.properties.provisioningState -eq 'Succeeded') {
        $serviceReady = $true
        Write-Pass "Probe Email Communication Service provisioned (dataLocation $($state.Object.properties.dataLocation))."
        break
    }
    Start-Sleep -Seconds 10
    Write-Info "Waiting for provisioning ($waited s): $($state.Object.properties.provisioningState)"
}

if (-not $serviceReady) {
    Write-Fail 'Probe Email Communication Service did not reach Succeeded within 180s.'
    Write-Warn "Run -Step cleanup before retrying."
    return
}

Write-Head "V1  Can '$Domain' be provisioned again in a SECOND Email Communication Service?"

$domainBody = @{
    location   = 'global'
    properties = @{
        domainManagement       = 'CustomerManaged'
        userEngagementTracking = 'Disabled'
    }
} | ConvertTo-Json -Depth 5

$createDomain = Invoke-Arm -Path "${probeDomainPath}?api-version=$CommunicationApiVersion" `
    -Method 'PUT' -Payload $domainBody -AllowFailure

if ($createDomain.StatusCode -notin @(200, 201)) {
    Write-Fail "V1 FAILED - Azure refused the domain in a second Email Communication Service (HTTP $($createDomain.StatusCode))."
    Write-Host "  Azure said:" -ForegroundColor Yellow
    Write-Host "  $($createDomain.Content)" -ForegroundColor Yellow
    Write-Head 'Verdict'
    Write-Host "  V1 = FAIL. A second ACS stack cannot reuse this domain, so per-stamp bounce routing" -ForegroundColor Red
    Write-Host "  needs a different approach. Run -Step cleanup to remove the probe service." -ForegroundColor Red
    return
}

Write-Pass "Azure accepted the domain PUT (HTTP $($createDomain.StatusCode))."

$probeDomain = $null
for ($waited = 0; $waited -lt 180; $waited += 10) {
    Start-Sleep -Seconds 10
    $state = Invoke-Arm -Path "${probeDomainPath}?api-version=$CommunicationApiVersion" -AllowFailure
    if ($state.StatusCode -eq 200) {
        $probeDomain = $state.Object
        if ($probeDomain.properties.provisioningState -eq 'Succeeded') { break }
        Write-Info "Waiting for domain provisioning ($waited s): $($probeDomain.properties.provisioningState)"
    }
}

if (-not $probeDomain -or $probeDomain.properties.provisioningState -ne 'Succeeded') {
    Write-Fail "Probe domain did not reach Succeeded within 180s (state: $($probeDomain.properties.provisioningState))."
    Write-Warn 'Run -Step cleanup before retrying.'
    return
}

Write-Pass 'Probe domain provisioned.'

Write-Head 'V1 evidence - the two TXT verification records'

$probeTxt = $probeDomain.properties.verificationRecords.Domain
$referenceTxt = $null
if ($referenceDomain) { $referenceTxt = $referenceDomain.properties.verificationRecords.Domain }

if ($referenceTxt) {
    Write-Host "  EXISTING ($($existingEmailService.name))" -ForegroundColor White
    Write-Host "      $($referenceTxt.type)  $($referenceTxt.name)  =  $($referenceTxt.value)" -ForegroundColor Gray
}
else {
    Write-Warn 'The existing domain exposed no Domain verification record to compare against.'
}

if ($probeTxt) {
    Write-Host "  PROBE    ($probeEmailServiceName)" -ForegroundColor White
    Write-Host "      $($probeTxt.type)  $($probeTxt.name)  =  $($probeTxt.value)" -ForegroundColor Gray
}
else {
    Write-Fail 'The probe domain exposed NO Domain verification record. Without its own TXT it can never verify.'
}

Write-Host ''
if ($probeTxt -and $referenceTxt) {
    if ($probeTxt.value -ne $referenceTxt.value) {
        Write-Pass 'The two records carry DIFFERENT values - each resource verifies independently, and both TXT records can coexist in the zone.'
    }
    else {
        Write-Warn 'Both records carry the SAME value. Verification may be shared rather than independent; inspect before relying on it.'
    }
    if ($probeTxt.name -eq $referenceTxt.name) {
        Write-Info "Both records sit at the same DNS name ($($probeTxt.name)). DNS allows multiple TXT values at one name, so this is expected."
    }
}

Write-Head 'SPF / DKIM records the probe would need'
foreach ($recordType in @('SPF', 'DKIM', 'DKIM2')) {
    $record = $probeDomain.properties.verificationRecords.$recordType
    if ($record) {
        Write-Host "  $recordType`: $($record.type) $($record.name) = $($record.value)" -ForegroundColor Gray
    }
}
Write-Info 'SPF and DKIM are domain-level. Compare these against the existing zone before adding anything.'

Write-Head 'Verdict'
Write-Host "  V1 (same domain in a second Email Communication Service) : $(if ($probeTxt) { 'PASS' } else { 'INCONCLUSIVE - no TXT issued' })" -ForegroundColor White
Write-Host "  V2 (dataLocation '$DataLocation' accepted)                 : PASS" -ForegroundColor White
Write-Host ''
Write-Host "  Neither DNS nor the live email path was touched. The probe cannot send mail - its domain is" -ForegroundColor White
Write-Host "  unverified and it is linked to no Communication Service." -ForegroundColor White
Write-Host ''
Write-Host "  Now run:  ./Verify-AcsPerStampEmail.ps1 -Step cleanup" -ForegroundColor Yellow
