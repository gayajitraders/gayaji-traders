@echo off
title Gaya Ji Traders Live Tunnel
echo =======================================================
echo Starting Gaya Ji Traders Live Tunnel via Serveo...
echo =======================================================
echo.
echo SSH is connecting to serveo.net...
echo.
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -R 80:localhost:5000 serveo.net
echo.
echo =======================================================
echo Tunnel closed. Press any key to exit.
echo =======================================================
pause
