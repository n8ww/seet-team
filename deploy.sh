#!/bin/zsh
# النشر: يحدّث أرقام النسخ عشان المتصفحات تجيب الملفات الجديدة، بعدها يرفع على GitHub
set -e
cd "$(dirname "$0")"
v=$(date +%s)
sed -i '' -E "s/\?v=[0-9]+/?v=$v/g" index.html js/app.js js/store.js
git add -A
git commit -m "${1:-تحديث}" || true
git push origin main
echo "تم النشر"
