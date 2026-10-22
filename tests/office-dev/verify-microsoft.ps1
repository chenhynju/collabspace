param([string]$Results = '.test-runs/office-integrated/results')
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $Results).Path
$checks = @()
$cleanupWarnings = @()

function Assert-Markers($Text, $Markers) {
  foreach ($marker in $Markers) {
    if (-not $Text.Contains($marker)) { throw 'Participant edit missing in Microsoft Office' }
  }
}

# Create our own automation instances. Never attach to a user's active document.
$app = $null; $doc = $null
try {
  $app = New-Object -ComObject Word.Application
  $app.Visible = $false; $app.DisplayAlerts = 0
  $doc = $app.Documents.Open((Join-Path $root 'word.docx'), $false, $true)
  $markers = Get-Content -LiteralPath (Join-Path $root 'word-markers.json') -Raw | ConvertFrom-Json
  Assert-Markers $doc.Content.Text $markers
  if ($doc.Tables.Count -ne 1 -or $doc.InlineShapes.Count -ne 1) { throw 'Word structure changed' }
  $copy = Join-Path $root 'word-microsoft.docx'; $format = 12
  $doc.SaveAs($copy, $format)
  $doc.Close(0); $doc = $null
  try { $app.Quit() } catch { $cleanupWarnings += 'Word first-instance quit RPC' }
  $app = New-Object -ComObject Word.Application
  $app.Visible = $false; $app.DisplayAlerts = 0
  $doc = $app.Documents.Open($copy, $false, $true)
  Assert-Markers $doc.Content.Text $markers
  $checks += @{ application = 'Microsoft Word'; version = $app.Version; participants = 2; tables = 1; images = 1; savedAndReopened = $true }
} finally {
  if ($doc) { try { $doc.Close(0) } catch { $cleanupWarnings += 'Word close RPC' } }
  if ($app) { try { $app.Quit() } catch { $cleanupWarnings += 'Word quit RPC' } }
}

$app = $null; $doc = $null
try {
  $app = New-Object -ComObject Excel.Application
  $app.Visible = $false; $app.DisplayAlerts = $false
  $doc = $app.Workbooks.Open((Join-Path $root 'sheet.xlsx'), 0, $true)
  $markers = Get-Content -LiteralPath (Join-Path $root 'sheet-markers.json') -Raw | ConvertFrom-Json
  $sheet = $doc.Worksheets.Item(1)
  Assert-Markers ($sheet.Range('C4').Text + ' ' + $sheet.Range('D4').Text) $markers
  if ($doc.Worksheets.Count -ne 2 -or $sheet.Range('B2').Formula -ne '=SUM(A2:A3)' -or $sheet.Range('B2').Value2 -ne 5) { throw 'Excel formula or worksheets changed' }
  $copy = Join-Path $root 'sheet-microsoft.xlsx'
  $doc.SaveCopyAs($copy); $doc.Close($false); $doc = $null
  try { $app.Quit() } catch { $cleanupWarnings += 'Excel first-instance quit RPC' }
  $app = New-Object -ComObject Excel.Application
  $app.Visible = $false; $app.DisplayAlerts = $false
  $doc = $app.Workbooks.Open($copy, 0, $true)
  Assert-Markers ($doc.Worksheets.Item(1).Range('C4').Text + ' ' + $doc.Worksheets.Item(1).Range('D4').Text) $markers
  $checks += @{ application = 'Microsoft Excel'; version = $app.Version; participants = 2; sheets = 2; formulaValue = 5; savedAndReopened = $true }
} finally {
  if ($doc) { try { $doc.Close($false) } catch { $cleanupWarnings += 'Excel close RPC' } }
  if ($app) { try { $app.Quit() } catch { $cleanupWarnings += 'Excel quit RPC' } }
}

$app = $null; $doc = $null
try {
  $app = New-Object -ComObject PowerPoint.Application
  $app.DisplayAlerts = 1
  $doc = $app.Presentations.Open((Join-Path $root 'slides.pptx'), -1, 0, 0)
  $markers = Get-Content -LiteralPath (Join-Path $root 'slides-markers.json') -Raw | ConvertFrom-Json
  $text = ''; $images = 0
  foreach ($slide in $doc.Slides) { foreach ($shape in $slide.Shapes) {
    if ($shape.HasTextFrame -and $shape.TextFrame.HasText) { $text += $shape.TextFrame.TextRange.Text }
    if ($shape.Type -eq 13) { $images++ }
  } }
  Assert-Markers $text $markers
  if ($doc.Slides.Count -ne 2 -or $images -ne 1) { throw 'PowerPoint structure changed' }
  $copy = Join-Path $root 'slides-microsoft.pptx'
  $doc.SaveCopyAs($copy, 24); $doc.Close(); $doc = $null
  try { $app.Quit() } catch { $cleanupWarnings += 'PowerPoint first-instance quit RPC' }
  $app = New-Object -ComObject PowerPoint.Application
  $app.DisplayAlerts = 1
  $doc = $app.Presentations.Open($copy, -1, 0, 0)
  $text = ''
  foreach ($slide in $doc.Slides) { foreach ($shape in $slide.Shapes) {
    if ($shape.HasTextFrame -and $shape.TextFrame.HasText) { $text += $shape.TextFrame.TextRange.Text }
  } }
  Assert-Markers $text $markers
  $checks += @{ application = 'Microsoft PowerPoint'; version = $app.Version; participants = 2; slides = 2; images = 1; savedAndReopened = $true }
} finally {
  if ($doc) { try { $doc.Close() } catch { $cleanupWarnings += 'PowerPoint close RPC' } }
  if ($app) { try { $app.Quit() } catch { $cleanupWarnings += 'PowerPoint quit RPC' } }
}
@{ checks = $checks; cleanupWarnings = $cleanupWarnings } | ConvertTo-Json -Depth 4
