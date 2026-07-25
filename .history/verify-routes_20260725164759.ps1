$urls = @('http://127.0.0.1:9002/','http://127.0.0.1:9002/dashboard','http://127.0.0.1:9002/dashboard/barista')
foreach ($url in $urls) {
  try {
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
    Write-Output "$url => $($resp.StatusCode)"
  } catch {
    $code = if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { $_.Exception.Response.StatusCode.Value__ } else { 'ERR' }
    Write-Output "$url => $code"
  }
}
