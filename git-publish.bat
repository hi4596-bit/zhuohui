@echo off
chcp 65001 >nul
title Zhuohui Floral - Git Publish
cd /d "%~dp0"

echo ==============================================
echo  Zhuohui Floral - Git 提交与发布
echo ==============================================
echo.

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo 当前文件夹不是 Git 仓库。
  echo.
  echo 请先在本文件夹执行一次初始化，例如：
  echo    git init
  echo    git branch -M main
  echo    git remote add origin https://github.com/hi4596-bit/zhuohui.git
  echo.
  pause
  exit /b 1
)

echo 变更概览：
echo ----------------------------------------------
git status --short
echo ----------------------------------------------
echo.
set "MSG="
set /p "MSG=请输入本次提交说明（直接回车使用 Content update）: "
if "%MSG%"=="" set "MSG=Content update"

git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo 没有需要提交的新变更。
  echo.
  pause
  exit /b 0
)

git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo 提交失败，请检查上面的 Git 信息。
  pause
  exit /b 1
)

echo.
echo 正在推送到远程仓库...
git push
if errorlevel 1 (
  echo.
  echo 推送失败。请检查：
  echo   1. 远程仓库地址是否正确（git remote -v）
  echo   2. 当前分支与远程分支是否对应（git branch -vv）
  echo   3. 是否已登录 GitHub（浏览器授权或 Personal Access Token）
  echo.
  pause
  exit /b 1
)

echo.
echo 已推送成功。若 GitHub Pages 已启用，网站会在 1-2 分钟内自动更新。
pause
