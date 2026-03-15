param(
  [string[]]$Roots = @('README.md', 'docs')
)

$ErrorActionPreference = 'Stop'

function Resolve-LinkPath {
  param(
    [string]$BaseFile,
    [string]$LinkTarget
  )

  $target = $LinkTarget.Trim()
  if ([string]::IsNullOrWhiteSpace($target)) {
    return $null
  }

  if ($target -match '^(https?:|mailto:|#)') {
    return @{ Skip = $true }
  }

  if ($target -match '^/?[A-Za-z]:/') {
    return @{ Error = 'absolute-drive-path' }
  }

  if ($target.StartsWith('/')) {
    return @{ Error = 'absolute-root-path' }
  }

  $pathPart = $target.Split('#')[0].Split('?')[0].Trim()
  if ([string]::IsNullOrWhiteSpace($pathPart)) {
    return @{ Skip = $true }
  }

  $baseDir = Split-Path -Parent $BaseFile
  if ([string]::IsNullOrWhiteSpace($baseDir)) {
    $baseDir = (Get-Location).Path
  }

  $candidate = Join-Path $baseDir $pathPart
  return @{ Candidate = $candidate }
}

$mdFiles = New-Object System.Collections.Generic.List[string]
foreach ($root in $Roots) {
  if (-not (Test-Path $root)) {
    continue
  }

  $item = Get-Item $root
  if ($item.PSIsContainer) {
    Get-ChildItem -Path $item.FullName -Recurse -File -Filter *.md | ForEach-Object {
      $mdFiles.Add($_.FullName)
    }
  } else {
    $mdFiles.Add($item.FullName)
  }
}

$issues = New-Object System.Collections.Generic.List[object]
$linkRegex = [regex]'\[[^\]]+\]\(([^)]+)\)'

foreach ($file in $mdFiles) {
  $lines = Get-Content $file
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $matches = $linkRegex.Matches($line)

    foreach ($match in $matches) {
      $target = $match.Groups[1].Value
      $resolution = Resolve-LinkPath -BaseFile $file -LinkTarget $target

      if ($null -eq $resolution) {
        continue
      }

      if ($resolution.ContainsKey('Skip')) {
        continue
      }

      if ($resolution.ContainsKey('Error')) {
        $issues.Add([pscustomobject]@{
          File = $file
          Line = $i + 1
          Target = $target
          Reason = $resolution.Error
        })
        continue
      }

      if (-not (Test-Path $resolution.Candidate)) {
        $issues.Add([pscustomobject]@{
          File = $file
          Line = $i + 1
          Target = $target
          Reason = 'missing-target'
        })
      }
    }
  }
}

if ($issues.Count -gt 0) {
  Write-Host "[docs:links:validate] FAIL - issues=$($issues.Count)"
  foreach ($issue in $issues) {
    $rel = $issue.File.Replace((Get-Location).Path + '\', '')
    Write-Host " - ${rel}:$($issue.Line) [$($issue.Reason)] -> $($issue.Target)"
  }
  exit 1
}

Write-Host "[docs:links:validate] OK - files=$($mdFiles.Count)"

