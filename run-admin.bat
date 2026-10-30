@echo off
chcp 65001 >nul
title Zhuohui Floral - Local Admin
cd /d "%~dp0"

echo ==============================================
echo  Zhuohui Floral - 本地后台启动
echo ==============================================
echo.

rem ---- Locate a Python 3 interpreter ----
set "PYEXE="
py -3 --version >nul 2>nul
if not errorlevel 1 set "PYEXE=py -3"
if not defined PYEXE (
  python --version >nul 2>nul
  if not errorlevel 1 set "PYEXE=python"
)
if not defined PYEXE (
  echo [错误] 没有找到可用的 Python 3。
  echo.
  echo 请先安装 Python 3：https://www.python.org/downloads/
  echo 安装时务必勾选 "Add python.exe to PATH"。
  echo.
  echo 提示：如果已安装但仍报错，可能是 Microsoft Store 的 python.exe 占位符，
  echo 请安装官方 Python 或关闭 "应用执行别名" 中的 python。
  echo.
  pause
  exit /b 1
)

if not exist "admin-tools\admin_server.py" (
  echo [错误] 找不到 admin-tools\admin_server.py
  echo 请确认文件完整解压，并保持原来的文件夹结构。
  echo.
  pause
  exit /b 1
)

echo 使用解释器: %PYEXE%

rem ---- Ensure Pillow is available (needed for crop / compress) ----
%PYEXE% -c "import PIL" >nul 2>nul
if not errorlevel 1 (
  echo 图片裁剪与压缩: Pillow 已安装，功能可用。
  goto :ready
)

echo.
echo [提示] 未检测到 Pillow，图片裁剪与压缩功能不可用。
echo        后台其余功能可正常使用。
set "INSTALLPIL="
set /p "INSTALLPIL=是否现在自动安装 Pillow？(Y/N，直接回车=Y): "
if /i "%INSTALLPIL%"=="N" goto :ready

echo 正在安装 Pillow，请稍候...
%PYEXE% -m pip install --upgrade Pillow
if errorlevel 1 (
  echo.
  echo [警告] Pillow 安装失败。可以稍后手动执行：
  echo        %PYEXE% -m pip install Pillow
  echo        常见原因：无网络、pip 未安装、或需要代理。
  echo.
) else (
  echo Pillow 安装完成，图片裁剪与压缩功能已启用。
)

:ready
echo 正在启动，成功后会打开浏览器 http://127.0.0.1:8765/admin
echo 停止服务请按 Ctrl+C
echo.

%PYEXE% "admin-tools\admin_server.py"
set "EXITCODE=%errorlevel%"

echo.
if not "%EXITCODE%"=="0" (
  echo [错误] 后台启动失败，退出码 %EXITCODE%。
  echo 常见原因：端口 8765 已被占用，或 admin_server.py 报错。
  echo 请查看上方的错误信息。
) else (
  echo 后台已停止。
)
echo.
pause
