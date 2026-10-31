#!/usr/bin/env bash
# Assembles the single-file app from src/ into dist/Suraasa_Sales_Control_Tower.html
set -e
cd "$(dirname "$0")"
cat src/shell_head.html src/styles.css src/shell_mid.html src/seed.js src/app.js src/shell_tail.html > dist/Suraasa_Sales_Control_Tower.html
cp dist/Suraasa_Sales_Control_Tower.html dist/index.html
echo "Built dist/Suraasa_Sales_Control_Tower.html and dist/index.html"
