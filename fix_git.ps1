git reset --soft origin/main
git rm --cached server/.env -q 2>$null
git rm --cached -r server/node_modules -q 2>$null
git rm --cached -r node_modules -q 2>$null
git add .
git commit -m "Update backend API and remove secrets"
git push origin main
