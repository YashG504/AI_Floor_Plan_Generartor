Move-Item -Path server\.env -Destination server\.env.backup -Force
git rm --cached server/.env -q 2>$null
git add .
git commit --amend --no-edit
git push origin main 2>&1 | Out-File -Encoding ASCII push_final_final_error.txt
Move-Item -Path server\.env.backup -Destination server\.env -Force
