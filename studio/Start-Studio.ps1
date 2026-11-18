# Local Studio
#
# The Git checkout contains the Studio source. Its existing local installation
# supplies the Windows runtimes, models, dependencies and reference assets.
param([switch]$PrepareOnly)
$ErrorActionPreference = 'Stop'
$studio = $PSScriptRoot
$install = if ($env:OPC_STUDIO_INSTALL) { $env:OPC_STUDIO_INSTALL } else {
    Join-Path (Split-Path (Split-Path $studio)) 'open-pose-costume-studio'
}
$install = (Resolve-Path -LiteralPath $install).Path
$node = Join-Path $install 'runtime\node\node.exe'
if (-not (Test-Path -LiteralPath $node -PathType Leaf)) { throw "Missing Studio runtime at $node" }
foreach ($name in 'public', 'node_modules') {
    $source = Join-Path $install $name
    $destination = Join-Path $studio $name
    if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "Missing Studio directory at $source" }
    if (-not (Test-Path -LiteralPath $destination)) {
        New-Item -ItemType Junction -Path $destination -Target $source | Out-Null
    }
}
if ($PrepareOnly) { return }
$env:OPC_STUDIO_INSTALL = $install
& $node (Join-Path $studio 'local\launch.mjs')
exit $LASTEXITCODE
