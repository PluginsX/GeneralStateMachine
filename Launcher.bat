@echo off
REM 首先切换CMD编码为UTF-8（65001为UTF-8代码页）
chcp 65001 >nul
REM 设置控制台字体为支持中文的字体模式
mode con cp select=65001 >nul
echo 正在启动本地服务器...
start /b python -m http.server 8000 --bind localhost

echo 等待服务器启动...
timeout /t 2 /nobreak >nul

echo 正在打开浏览器...
start http://localhost:8000/public

echo 操作完成！服务器运行在 http://localhost:8000/public/index.html
echo 局域网设备可通过 http://[服务器IP]:8000/public/index.html 访问
echo 按 Ctrl+C 可停止服务器
pause >nul