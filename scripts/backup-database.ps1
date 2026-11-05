#Requires -Version 5.1
<#
.SYNOPSIS
    Creates a timestamped PostgreSQL backup of the AegisGraph database.

.DESCRIPTION
    Uses `pg_dump` inside the running AegisGraph database container. Credentials
    are read from the local .env file and are ONLY passed via Docker's
    environment (never echoed, never logged). Password is not needed because the
    dump runs inside the container over the local socket.

.EXAMPLE
    .\scripts\backup-database.ps1
    .\scripts\backup-database.ps1 -OutputDirectory D:\my-backups
#>
[CmdletBinding()]
param(
    [string]$OutputDirectory = "",
    [string]$RepoRoot = "",
    [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# $PSScriptRoot is not evaluated inside param defaults; compute here.
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot "..\backups" }
if (-not $RepoRoot) { $RepoRoot = Join-Path $PSScriptRoot ".." }
if (-not $EnvFile) { $EnvFile = Join-Path $PSScriptRoot "..\.env" }

function Write-Fail([string]$message) {
    Write-Host "ERROR: $message" -ForegroundColor Red
    exit 1
}

# --- Preconditions -----------------------------------------------------------
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Fail "Docker CLI was not found. Install Docker Desktop first."
}
if (-not (Test-Path $EnvFile)) {
    Write-Fail "Environment file not found at '$EnvFile'. Copy .env.example to .env first."
}

# --- Read DB identifiers from .env (never printed) ---------------------------
$dbConfig = @{}
Get-Content $EnvFile | Where-Object { $_ -match '^\s*(POSTGRES_(DB|USER|PASSWORD))="?(.*?)"?$' } | ForEach-Object {
    $key = $Matches[1]
    $value = $Matches[3]
    $dbConfig[$key] = $value
}
if (-not $dbConfig.ContainsKey("POSTGRES_DB") -or -not $dbConfig.ContainsKey("POSTGRES_USER")) {
    Write-Fail ".env is missing POSTGRES_DB or POSTGRES_USER values."
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$fileLeaf = "aegisgraph_backup_$timestamp.sql"
$backupPath = Join-Path $OutputDirectory $fileLeaf

# --- Dump --------------------------------------------------------------------
try {
    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

    Write-Host "Creating backup of database '$($dbConfig['POSTGRES_DB'])'..."
    # cmd /c redirect keeps raw UTF-8 bytes (PowerShell redirects re-encode).
    $composeArgs = @(
        "compose", "--project-directory", $RepoRoot, "exec", "-T", "db",
        "pg_dump", "-U", $dbConfig["POSTGRES_USER"], "-d", $dbConfig["POSTGRES_DB"],
        "--no-owner", "--format=plain"
    )
    $cmdline = "docker " + ($composeArgs -join " ") + ' > "' + $backupPath + '"'
    cmd /c $cmdline
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "pg_dump exited with code $LASTEXITCODE. Removing partial file."
        Remove-Item $backupPath -ErrorAction SilentlyContinue
        exit 1
    }
} catch {
    Write-Fail "Backup failed: $($_.Exception.Message)"
}

# --- Verify ------------------------------------------------------------------
if (-not (Test-Path $backupPath)) {
    Write-Fail "Backup file was not created."
}
$expectedSignature = "-- PostgreSQL database dump"  # plain-format pg_dump header (>0.9 checked case-insensitively).
try {
    $stream = [System.IO.File]::OpenRead($backupPath)
    $header = New-Object byte[] 64
    $read = $stream.Read($header, 0, 64)
    $stream.Close()
    $signature = [System.Text.Encoding]::UTF8.GetString($header, 0, $read)
    if ($signature -notmatch [regex]::Escape("-- PostgreSQL database dump")) {
        Write-Fail "Backup file header is invalid (expected PostgreSQL plain dump). Removing file."
        Remove-Item $backupPath -ErrorAction SilentlyContinue
        exit 1
    }
} catch {
    Write-Fail "Could not verify backup header: $($_.Exception.Message)"
}

$sizeKb = [math]::Round((Get-Item $backupPath).Length / 1KB, 1)
Write-Host ""
Write-Host ("SUCCESS: backup created -> {0} ({1} KB)" -f $backupPath, $sizeKb) -ForegroundColor Green
exit 0
