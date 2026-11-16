@echo off
setlocal
cd /d %~dp0
set VITE_API_BASE_URL=http://127.0.0.1:8000
npm run dev