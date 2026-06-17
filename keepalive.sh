#!/bin/bash
cd /home/z/my-project
while true; do
  if ! lsof -i :3000 >/dev/null 2>&1; then
    echo "$(date): Server down, restarting..." >> /home/z/my-project/keepalive.log
    rm -rf .next
    npx next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
  fi
  sleep 10
done
