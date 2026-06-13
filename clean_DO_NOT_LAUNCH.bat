@echo off
echo 🧹 Nettoyage du projet...

REM Supprimer les dossiers
if exist www rmdir /s /q www
if exist .ionic rmdir /s /q .ionic
if exist .angular rmdir /s /q .angular
if exist dist rmdir /s /q dist

echo ✅ Nettoyage terminé!