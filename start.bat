@echo off
chcp 65001 > nul
title Kotodama - Hệ thống học tiếng Nhật AI
echo ========================================================
echo               KOTODAMA - KHỞI CHẠY HỆ THỐNG
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Kiểm tra node_modules
if not exist "node_modules" (
    echo [1/3] Đang cài đặt các thư viện phụ thuộc (npm install)...
    call npm install
    if errorlevel 1 (
        echo [LỖI] Cài đặt thư viện thất bại.
        pause
        exit /b 1
    )
) else (
    echo [1/3] Thư viện node_modules đã sẵn sàng.
)

:: 2. Chạy migration Database (Neon PostgreSQL)
echo [2/3] Đang đồng bộ cơ sở dữ liệu (npm run db:migrate)...
call npm run db:migrate
if errorlevel 1 (
    echo [CẢNH BÁO] Không thể chạy migration database. Vui lòng kiểm tra lại DATABASE_URL trong file .env
)

:: 3. Khởi chạy toàn bộ hệ thống
echo [3/3] Đang khởi chạy API Server, Media Worker và Frontend...
echo.
echo ========================================================
echo  Frontend UI:  http://localhost:5173
echo  API Backend:  http://127.0.0.1:8787
echo  Nhấn Ctrl+C để dừng tất cả các dịch vụ.
echo ========================================================
echo.

:: Mở trình duyệt web
start "" http://localhost:5173

:: Khởi chạy các dịch vụ local đồng thời
call npm run dev:local

pause
