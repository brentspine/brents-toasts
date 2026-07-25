
@echo off
setlocal enabledelayedexpansion

set /p commit_msg="Commit message: "
if "%commit_msg%"=="" goto :emptymsg

git pull
if errorlevel 1 goto :error

git add .
if errorlevel 1 goto :error

git commit -m "%commit_msg%" -a
if errorlevel 1 goto :error

call npm version patch
if errorlevel 1 goto :error

git pull
if errorlevel 1 goto :error

git push
if errorlevel 1 goto :error

git push --tags
if errorlevel 1 goto :error

echo Done.
goto :eof

:emptymsg
echo Commit message cannot be empty. Aborting.
exit /b 1

:error
echo An error occurred. Aborting.
exit /b 1