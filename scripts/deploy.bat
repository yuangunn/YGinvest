@echo off
REM Plan #34: Windows 통합 배포 — Git Bash로 deploy.sh 실행.
REM
REM 사용법: 더블 클릭 또는 scripts\deploy.bat

setlocal

REM Git Bash 경로 자동 탐색
set "BASH_EXE="
if exist "C:\Program Files\Git\bin\bash.exe" set "BASH_EXE=C:\Program Files\Git\bin\bash.exe"
if exist "C:\Program Files (x86)\Git\bin\bash.exe" set "BASH_EXE=C:\Program Files (x86)\Git\bin\bash.exe"
if exist "%USERPROFILE%\AppData\Local\Programs\Git\bin\bash.exe" set "BASH_EXE=%USERPROFILE%\AppData\Local\Programs\Git\bin\bash.exe"

if "%BASH_EXE%"=="" (
  echo [ERROR] Git Bash를 찾을 수 없습니다. https://gitforwindows.org 에서 설치하세요.
  pause
  exit /b 1
)

REM 프로젝트 루트로 이동 (이 bat 파일의 부모 디렉토리)
cd /d "%~dp0.."

echo [deploy.bat] Git Bash로 deploy.sh 실행...
"%BASH_EXE%" -l ./scripts/deploy.sh

if errorlevel 1 (
  echo.
  echo [deploy.bat] 실패. 위 에러 메시지 확인.
  pause
  exit /b 1
)

echo.
echo [deploy.bat] 완료. 아무 키나 눌러서 닫기.
pause
