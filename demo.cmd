
@echo off
setlocal enabledelayedexpansion

echo Building brents-toasts library...
call npm run build
if errorlevel 1 goto :error

if not exist "demo\node_modules" (
    echo Installing demo dependencies...
    pushd demo
    call npm install
    if errorlevel 1 (
        popd
        goto :error
    )
    popd
)

echo Starting demo dev server...
pushd demo
call npm start
if errorlevel 1 (
    popd
    goto :error
)
popd

goto :eof

:error
echo An error occurred. Aborting.
exit /b 1
