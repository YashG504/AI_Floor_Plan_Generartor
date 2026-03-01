Move-Item -Path server\.env -Destination ..\server_env_backup -Force -ErrorAction SilentlyContinue
Move-Item -Path server\.env.backup -Destination ..\server_env_backup2 -Force -ErrorAction SilentlyContinue
git reset --soft origin/main
git rm --cached -r server/.env server/.env.backup node_modules server/node_modules -q 2>$null
git add .
git commit -m "Update backend API and remove secrets"
git push origin main 2>&1 | Out-File -Encoding ASCII push_success.txt
Move-Item -Path ..\server_env_backup -Destination server\.env -Force -ErrorAction SilentlyContinue
Move-Item -Path ..\server_env_backup2 -Destination server\.env.backup -Force -ErrorAction SilentlyContinue
