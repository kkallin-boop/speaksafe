@echo off
cd /d "%~dp0"
call venv\Scripts\activate
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://127.0.0.1:5000"
python app.py
