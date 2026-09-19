# ============================================================
# Test-Daten für ToolSync API
# ============================================================

$baseUrl = "http://localhost:8000"

Write-Host " ToolSync Test-Daten werden angelegt..." -ForegroundColor Cyan

# ============================================================
# Schritt 1: Benutzer anlegen
# ============================================================
Write-Host "`n Schritt 1: Benutzer anlegen" -ForegroundColor Yellow

# Admin anlegen
$adminData = @{
    personal_number = "admin1"
    first_name = "Admin"
    last_name = "User"
    display_name = "Admin User"
    is_active = $true
    is_admin = $true
    hashed_password = "123"
    role_id = $null
} | ConvertTo-Json

try {
    $admin = Invoke-RestMethod -Uri "$baseUrl/api/users/" -Method Post -Body $adminData -ContentType "application/json"
    Write-Host " Admin angelegt: $($admin.personal_number)" -ForegroundColor Green
} catch {
    Write-Host " Admin konnte nicht angelegt werden: $($_.Exception.Message)" -ForegroundColor Red
}

# Mitarbeiter anlegen
$memberData = @{
    personal_number = "1001"
    first_name = "Max"
    last_name = "Mustermann"
    display_name = "Max Mustermann"
    is_active = $true
    is_admin = $false
    hashed_password = $null
    role_id = $null
} | ConvertTo-Json

try {
    $member = Invoke-RestMethod -Uri "$baseUrl/api/users/" -Method Post -Body $memberData -ContentType "application/json"
    Write-Host " Mitarbeiter angelegt: $($member.personal_number)" -ForegroundColor Green
} catch {
    Write-Host " Mitarbeiter konnte nicht angelegt werden: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================
# Schritt 2: Login (Token holen)
# ============================================================
Write-Host "`n Schritt 2: Login" -ForegroundColor Yellow

# Mitarbeiter-Login (ohne Passwort)
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login?personal_number=1001" -Method Post
    $token = $loginResponse.access_token
    Write-Host " Mitarbeiter-Login erfolgreich" -ForegroundColor Green
} catch {
    Write-Host " Mitarbeiter-Login fehlgeschlagen: $($_.Exception.Message)" -ForegroundColor Red
    $token = $null
}

# Admin-Login (mit Passwort)
if ($token) {
    try {
        $adminLogin = Invoke-RestMethod -Uri "$baseUrl/api/auth/admin/login?personal_number=admin1&password=test123" -Method Post
        $adminToken = $adminLogin.access_token
        Write-Host " Admin-Login erfolgreich" -ForegroundColor Green
    } catch {
        Write-Host " Admin-Login fehlgeschlagen: $($_.Exception.Message)" -ForegroundColor Red
        $adminToken = $null
    }
}

# ============================================================
# Schritt 3: Werkzeug anlegen (mit Token)
# ============================================================
if ($token) {
    Write-Host "`n Schritt 3: Werkzeug anlegen" -ForegroundColor Yellow

    $headers = @{ Authorization = "Bearer $token" }

    # Werkzeug 1 (Rundstempel)
    $toolData1 = @{
        tool_id = "01056000"
        category = "Stempel"
        status = "available"
        is_storage = $false
        allow_duplicate_id = $false
        plant_id = 1
        tool_type_id = 1
        storage_location_id = $null
        machine_id = $null
        customer_id = $null
    } | ConvertTo-Json

    try {
        $tool1 = Invoke-RestMethod -Uri "$baseUrl/api/tools/" -Method Post -Body $toolData1 -ContentType "application/json" -Headers $headers
        Write-Host " Werkzeug 1 angelegt: $($tool1.tool_id)" -ForegroundColor Green
    } catch {
        Write-Host " Werkzeug 1 fehlgeschlagen: $($_.Exception.Message)" -ForegroundColor Red
    }

    # Werkzeug 2 (Abstreifer)
    $toolData2 = @{
        tool_id = "02078000"
        category = "Abstreifer"
        status = "available"
        is_storage = $false
        allow_duplicate_id = $false
        plant_id = 1
        tool_type_id = 2
        storage_location_id = $null
        machine_id = $null
        customer_id = $null
    } | ConvertTo-Json

    try {
        $tool2 = Invoke-RestMethod -Uri "$baseUrl/api/tools/" -Method Post -Body $toolData2 -ContentType "application/json" -Headers $headers
        Write-Host " Werkzeug 2 angelegt: $($tool2.tool_id)" -ForegroundColor Green
    } catch {
        Write-Host " Werkzeug 2 fehlgeschlagen: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================
# Schritt 4: Daten abrufen
# ============================================================
if ($token) {
    Write-Host "`n Schritt 4: Daten abrufen" -ForegroundColor Yellow

    # Alle Benutzer
    try {
        $users = Invoke-RestMethod -Uri "$baseUrl/api/users/" -Method Get -Headers $headers
        Write-Host " Benutzer abgerufen: $($users.Count)" -ForegroundColor Green
    } catch {
        Write-Host " Benutzer abrufen fehlgeschlagen" -ForegroundColor Red
    }

    # Alle Werkzeuge
    try {
        $tools = Invoke-RestMethod -Uri "$baseUrl/api/tools/" -Method Get -Headers $headers
        Write-Host " Werkzeuge abgerufen: $($tools.Count)" -ForegroundColor Green
    } catch {
        Write-Host " Werkzeuge abrufen fehlgeschlagen" -ForegroundColor Red
    }
}

# ============================================================
# Fertig
# ============================================================
Write-Host "`n Test-Daten angelegt!" -ForegroundColor Cyan