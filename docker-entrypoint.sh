#!/bin/sh
# Give Chrome a display before handing off to the app.
#
# We start Xvfb directly rather than using xvfb-run: xvfb-run wraps the process
# in a pipe, which makes Node block-buffer its output (so container logs stay
# empty for hours) and gets in the way of signal delivery on shutdown.
set -e

DISPLAY_NUM="${FC_DISPLAY_NUM:-99}"

Xvfb ":${DISPLAY_NUM}" -screen 0 1280x800x24 -nolisten tcp &
export DISPLAY=":${DISPLAY_NUM}"

# Wait for the display socket rather than sleeping a guessed interval.
i=0
while [ ! -e "/tmp/.X11-unix/X${DISPLAY_NUM}" ]; do
  i=$((i + 1))
  if [ "$i" -gt 100 ]; then
    echo "Xvfb failed to start on display :${DISPLAY_NUM}" >&2
    exit 1
  fi
  sleep 0.1
done

echo "🖥️  Virtual display ready on :${DISPLAY_NUM}"

# exec so the app becomes PID 1's child directly: unbuffered logs, and SIGTERM
# reaches the scheduler's shutdown handler.
exec "$@"
