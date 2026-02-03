#!/bin/bash
# Quick fix script to add type assertions for query parameters

find src/controllers -name "*.ts" -type f -exec sed -i \
  -e 's/category as string/category as string | undefined/g' \
  -e 's/search as string/(search as string | string[] | undefined) as string | undefined/g' \
  EOF
chmod +x fix-query-params.sh
