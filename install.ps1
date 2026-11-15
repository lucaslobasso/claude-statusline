<#
.SYNOPSIS  Installs (or removes) the claude-statusline status line.
.DESCRIPTION
  Copies statusline.mjs to ~/.claude/statusline and points the statusLine setting of
  ~/.claude/settings.json at it (backup: settings.json.bak-statusline).
  -Uninstall removes the setting again and the installed copy.
#>
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$claude   = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $env:USERPROFILE '.claude' }
$dest     = Join-Path $claude 'statusline'
$settings = Join-Path $claude 'settings.json'
$target   = (Join-Path $dest 'statusline.mjs') -replace '\\', '/'

$json = if (Test-Path $settings) { Get-Content $settings -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
if (Test-Path $settings) { Copy-Item $settings "$settings.bak-statusline" -Force }

if ($Uninstall) {
  if ($json.statusLine -and $json.statusLine.command -like "*$target*") { $json.PSObject.Properties.Remove('statusLine') }
  $json | ConvertTo-Json -Depth 32 | Set-Content $settings -Encoding utf8
  Remove-Item (Join-Path $dest 'statusline.mjs') -ErrorAction SilentlyContinue
  Write-Host "Removed. (usage.json kept in $dest)"
  return
}

New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'statusline.mjs') $dest -Force
$status = [pscustomobject]@{ type = 'command'; command = "node `"$target`""; padding = 0; refreshInterval = 10 }
$json | Add-Member -NotePropertyName statusLine -NotePropertyValue $status -Force
$json | ConvertTo-Json -Depth 32 | Set-Content $settings -Encoding utf8
Write-Host "Installed to $dest. Open a new session to see it."
