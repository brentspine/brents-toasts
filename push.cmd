
@echo off
setlocal enabledelayedexpansion

set /p commit_msg="Commit message: "
if "%commit_msg%"=="" goto :emptymsg

set /p bump_type="Version bump (patch/minor/major/none) [patch]: "
if "%bump_type%"=="" set bump_type=patch
if not "%bump_type%"=="patch" if not "%bump_type%"=="minor" if not "%bump_type%"=="major" if not "%bump_type%"=="none" goto :badbump

git pull
if errorlevel 1 goto :error

git add .
if errorlevel 1 goto :error

git commit -m "%commit_msg%" -a
if errorlevel 1 goto :error

if "%bump_type%"=="none" goto :skipbump
call npm version %bump_type%
if errorlevel 1 goto :error

:skipbump
git pull
if errorlevel 1 goto :error

git push
if errorlevel 1 goto :error

if "%bump_type%"=="none" goto :done
git push --tags
if errorlevel 1 goto :error

:done

echo Done.
goto :eof

:emptymsg
echo Commit message cannot be empty. Aborting.
exit /b 1

:badbump
echo Invalid version bump type "%bump_type%". Use patch, minor, major, or none. Aborting.
exit /b 1

:error
echo An error occurred. Aborting.
exit /b 1