param(
  [string]$FrontendRepoPath
)

$ErrorActionPreference = "Stop"

$backendRepoPath = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($FrontendRepoPath)) {
  $workspaceRoot = Split-Path -Parent $backendRepoPath
  $FrontendRepoPath = Join-Path $workspaceRoot "FRONTEND-STACK-NEXT-TAILWIND"
}

$backendOpenApiPath = Join-Path $backendRepoPath "openapi"
$frontendOpenApiPath = Join-Path $FrontendRepoPath "openapi"

$docPairs = @(
  @{ Backend = "docs/frontend/README.md"; Frontend = "docs/README.md" },
  @{ Backend = "docs/frontend/10_IMPLEMENTATION_GUIDE_V2.md"; Frontend = "docs/10_IMPLEMENTATION_GUIDE_V2.md" },
  @{ Backend = "docs/frontend/20_ACCESS_MATRIX.md"; Frontend = "docs/20_ACCESS_MATRIX.md" },
  @{ Backend = "docs/frontend/30_API_CLIENT_STANDARD.md"; Frontend = "docs/30_API_CLIENT_STANDARD.md" },
  @{ Backend = "docs/frontend/40_STATE_AND_CACHE_POLICY.md"; Frontend = "docs/40_STATE_AND_CACHE_POLICY.md" },
  @{ Backend = "docs/frontend/50_ERROR_CATALOG.md"; Frontend = "docs/50_ERROR_CATALOG.md" },
  @{ Backend = "docs/frontend/60_MOCKING_GUIDE.md"; Frontend = "docs/60_MOCKING_GUIDE.md" },
  @{ Backend = "docs/frontend/70_E2E_CRITICAL_FLOWS.md"; Frontend = "docs/70_E2E_CRITICAL_FLOWS.md" },
  @{ Backend = "docs/frontend/80_BACKEND_DEPENDENCIES.md"; Frontend = "docs/80_BACKEND_DEPENDENCIES.md" },
  @{ Backend = "docs/frontend/90_DOD_CHECKLIST.md"; Frontend = "docs/90_DOD_CHECKLIST.md" },
  @{ Backend = "docs/frontend/95_DOCS_DEPRECATION_MATRIX.md"; Frontend = "docs/95_DOCS_DEPRECATION_MATRIX.md" },
  @{ Backend = "docs/frontend/_deprecated/README.md"; Frontend = "docs/_deprecated/README.md" },
  @{ Backend = "docs/frontend/_deprecated/90_INTEGRATION_PLAN_V1.md"; Frontend = "docs/_deprecated/90_INTEGRATION_PLAN_V1.md" }
)

function Get-FileHashHex([string]$path) {
  (Get-FileHash -Algorithm SHA256 -Path $path).Hash
}

function Collect-Hashes([string]$root) {
  $map = @{}
  Get-ChildItem -Path $root -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length + 1).Replace('\\', '/')
    $map[$rel] = Get-FileHashHex $_.FullName
  }
  return $map
}

if (-not (Test-Path $backendOpenApiPath)) {
  throw "No se encontro OpenAPI backend: $backendOpenApiPath"
}

if (-not (Test-Path $frontendOpenApiPath)) {
  throw "No se encontro OpenAPI frontend: $frontendOpenApiPath"
}

Write-Host "== OpenAPI coupling check =="
$backendHashes = Collect-Hashes $backendOpenApiPath
$frontendHashes = Collect-Hashes $frontendOpenApiPath

$backendOnly = @($backendHashes.Keys | Where-Object { -not $frontendHashes.ContainsKey($_) })
$frontendOnly = @($frontendHashes.Keys | Where-Object { -not $backendHashes.ContainsKey($_) })
$changed = @($backendHashes.Keys | Where-Object { $frontendHashes.ContainsKey($_) -and $backendHashes[$_] -ne $frontendHashes[$_] })

if ($backendOnly.Count -eq 0 -and $frontendOnly.Count -eq 0 -and $changed.Count -eq 0) {
  Write-Host "OK: OpenAPI FE/API sin drift"
} else {
  Write-Host "DRIFT: OpenAPI FE/API no esta acoplado"
  Write-Host "backend_only=$($backendOnly.Count) frontend_only=$($frontendOnly.Count) changed=$($changed.Count)"
  exit 1
}

Write-Host "`n== Frontend docs coupling check =="
$hasDocsDrift = $false

foreach ($pair in $docPairs) {
  $backendPath = Join-Path $backendRepoPath $pair.Backend
  $frontendPath = Join-Path $FrontendRepoPath $pair.Frontend

  if (-not (Test-Path $backendPath) -or -not (Test-Path $frontendPath)) {
    $hasDocsDrift = $true
    Write-Host "MISSING: $($pair.Backend) or $($pair.Frontend)"
    continue
  }

  $same = (Get-FileHashHex $backendPath) -eq (Get-FileHashHex $frontendPath)
  if ($same) {
    Write-Host "OK: $($pair.Backend)"
  } else {
    $hasDocsDrift = $true
    Write-Host "DRIFT: $($pair.Backend)"
  }
}

if ($hasDocsDrift) {
  Write-Host "`nWARN: hay drift documental FE/API. Abrir PR espejo en ambos repos."
} else {
  Write-Host "`nOK: docs frontend espejo FE/API sin drift"
}

Write-Host "Coupling check OK: OpenAPI FE/API acoplado"
