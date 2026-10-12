# README.html の SVG 図の検査を、PlayWright 共有環境で実行する
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/../..").Path
$tests = Join-Path $root 'tests'
$out = Join-Path $root 'tmp/pw'
if (-not (Test-Path $tests)) { throw "テストの置き場が見つかりません: tests" }
Write-Host 'SVG 図の検査を実行します（chromium）'
playwright-test --test-dir $tests --out-dir $out --project=chromium --reporter=line
exit $LASTEXITCODE
