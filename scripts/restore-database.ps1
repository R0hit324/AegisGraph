#Requires -Version 5.1
<#
.SYNOPSIS
    Restores an AegisGraph database backup (DESTRUCTIVE - replaces current data).

.DESCRIPTION
    Drops the current local database, recreates it, and streams a backup file
    produced by backup-database.ps1 (PostgreSQL custom format) back in.
    Requires explicit typed confirmation unless -Force is provided.
    Credentials come from .env and are never echoed.

.EXAMPLE
    .\scripts\restore-database.ps1 -BackupPath .\backups\aegisgraph_backup_20260101_120000.sql
    .\scripts\restore-database.ps1 -BackupPath .\backups\x.sql -Force
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [switch]$Force,
    [string]$RepoRoot = "",
    [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# $PSScriptRoot is not evaluated inside param defaults; compute here.
if (-not $RepoRoot) { $RepoRoot = Join-Path $PSScriptRoot ".." }
if (-not $EnvFile) { $EnvFile = Join-Path $PSScriptRoot "..\.env" }

function Write-Fail([string]$message) {
    Write-Host "ERROR: $message" -ForegroundColor Red
    exit 1
}

# --- Validate the backup file ------------------------------------------------
if (-not (Test-Path $BackupPath -PathType Leaf)) {
    Write-Fail "Backup file not found: '$BackupPath'"
}
try {
    $resolvedDir = (Resolve-Path (Split-Path -Parent $BackupPath)).Path
    $resolvedLeaf = Split-Path -Leaf $BackupPath
    $BackupPath = Join-Path $resolvedDir $resolvedLeaf
} catch {
    Write-Fail "Could not resolve backup path: $($_.Exception.Message)"
}

if (-not (Test-Path $EnvFile)) {
    Write-Fail "Environment file not found at '$EnvFile'. Copy .env.example to .env first."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Fail "Docker CLI was not found. Install Docker Desktop first."
}

# --- Read DB identifiers (validated to be simple identifiers) ------------------
$dbConfig = @{}
Get-Content $EnvFile | Where-Object { $_ -match '^\s*(POSTGRES_(DB|USER|PASSWORD))="?(.*?)"?$' } | ForEach-Object {
    $dbConfig[$Matches[1]] = $Matches[3]
}
if (-not $dbConfig.ContainsKey("POSTGRES_DB") -or -not $dbConfig.ContainsKey("POSTGRES_USER")) {
    Write-Fail ".env is missing POSTGRES_DB or POSTGRES_USER values."
}
$database = $dbConfig["POSTGRES_DB"]
$user = $dbConfig["POSTGRES_USER"]
if ($database -notmatch '^[A-Za-z0-9_]+$' -or $user -notmatch '^[A-Za-z0-9_]+$') {
    Write-Fail "POSTGRES_DB/POSTGRES_USER must be simple identifiers for restore safety."
}

# --- Explicit, typed confirmation ---------------------------------------------
if (-not $Force) {
    Write-Host ""
    Write-Warning "This DESTROYS the current database '$database' and replaces it with '$((Get-Item $BackupPath).Name)'."
    $answer = Read-Host "Type RESTORE to confirm"
    if ($answer -cne "RESTORE") {
        Write-Host "Restore cancelled. No changes were made." -ForegroundColor Yellow
        exit 0
    }
}

# --- Drop, recreate, restore ---------------------------------------------------
try {
    Write-Host "Dropping and recreating database '$database'..."
    docker compose --project-directory $RepoRoot exec -T db `
        psql -U $user -d postgres -v ON_ERROR_STOP=1 `
        -c "DROP DATABASE IF EXISTS `"$database`";" `
        -c "CREATE DATABASE `"$database`" OWNER `"$user`";" | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Fail "Could not recreate database (exit $LASTEXITCODE)." }

    Write-Host "Restoring from backup..."
    $psqlArgs = "compose --project-directory $RepoRoot exec -T db psql -U $user -d $database -v ON_ERROR_STOP=1 --quiet"
    $cmdline = "docker $psqlArgs < `"$BackupPath`""
    cmd /c $cmdline 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Restore failed (psql exit $LASTEXITCODE). The database may be in an incomplete state; remove it with 'docker compose down -v' and start again."
    }
} catch {
    Write-Fail "Restore failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "SUCCESS: database '$database' restored from $BackupPath" -ForegroundColor Green
exit 0
