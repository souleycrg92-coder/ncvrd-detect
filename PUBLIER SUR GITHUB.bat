@echo off
cd /d "D:\Desktop\Bureau\NCVRD Detect"

echo.
echo ================================
echo   PUBLICATION NCVRD DETECT
echo ================================
echo.

git add -f index.html LOGO.png "Bannière.png" sw.js manifest.json

git diff --cached --quiet
if %errorlevel%==0 (
  echo Aucun changement detecte dans index.html et LOGO.png
  echo Le site est deja a jour.
) else (
  git commit -m "Mise a jour NCVRD Detect"
  git push
  echo.
  echo ================================
  echo   SITE MIS A JOUR !
  echo   https://neoconceptvrd.github.io/ncvrd-detect/
  echo ================================
)

echo.
pause
