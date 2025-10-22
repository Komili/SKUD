# === HIKVISION FACE ID EVENT CALLBACK SETUP SCRIPT ===
# Автор: Комил, автоматическая интеграция DS-K1T342MX-E1 с Node.js сервером

# Параметры устройства и сервера
$deviceIp   = "192.168.1.191"
$serverIp   = "192.168.1.129"
$serverPort = "3001"
$username   = "admin"
$password   = "qwerty321."

Write-Host "=== Настройка HTTP Event Callback на Hikvision ($deviceIp) ===`n"

# XML для включения HTTP уведомлений
$xml = @"
<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
    <HttpHostNotification>
        <id>1</id>
        <url>http://$serverIp:$serverPort/event</url>
        <protocolType>HTTP</protocolType>
        <parameterFormatType>JSON</parameterFormatType>
        <httpAuthenticationMethod>none</httpAuthenticationMethod>
        <uploadImages>false</uploadImages>
        <eventTypes>
            <eventType>All</eventType>
        </eventTypes>
    </HttpHostNotification>
</HttpHostNotificationList>
"@

# Отправляем конфигурацию на устройство
try {
    $url = "http://$deviceIp/ISAPI/Event/notification/httpHosts"
    Write-Host "→ Отправка конфигурации на $url..."
    $response = Invoke-RestMethod -Uri $url -Method Put -Body $xml -ContentType "application/xml" -Credential (New-Object System.Management.Automation.PSCredential ($username, (ConvertTo-SecureString $password -AsPlainText -Force)))
    Write-Host "✅ Конфигурация успешно отправлена.`n"
}
catch {
    Write-Host "❌ Ошибка при отправке конфигурации: $($_.Exception.Message)`n"
}

# Проверяем, что callback прописан
try {
    Write-Host "→ Проверка настроек устройства..."
    $checkUrl = "http://$deviceIp/ISAPI/Event/notification/httpHosts"
    $checkResponse = Invoke-RestMethod -Uri $checkUrl -Method Get -Credential (New-Object System.Management.Automation.PSCredential ($username, (ConvertTo-SecureString $password -AsPlainText -Force)))
    Write-Host "`n📋 Текущее состояние callback:"
    $checkResponse.HttpHostNotificationList.HttpHostNotification | ForEach-Object {
        Write-Host ("  - URL: " + $_.url)
        Write-Host ("  - Protocol: " + $_.protocolType)
        Write-Host ("  - Format: " + $_.parameterFormatType)
        Write-Host ("  - Events: " + ($_.eventTypes.eventType -join ", "))
        Write-Host ""
    }
    Write-Host "✅ Проверка завершена."
}
catch {
    Write-Host "⚠️ Ошибка при проверке настроек: $($_.Exception.Message)"
}

Write-Host "`n=== Скрипт завершён. Теперь устройство должно отправлять события на http://$serverIp:$serverPort/event ==="
