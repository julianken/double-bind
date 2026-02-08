#!/bin/bash
# Restore Claude Code global settings from gist
# Run this after cloning the repo on a new machine

set -e

echo "Restoring Claude Code settings..."

mkdir -p ~/.claude

# Find and clone the settings gist
GIST_ID=$(gh gist list | grep "Claude Code" | awk '{print $1}')

if [ -z "$GIST_ID" ]; then
  echo "Error: No 'Claude Code' gist found. Make sure you're logged into gh."
  exit 1
fi

TEMP_DIR=$(mktemp -d)
gh gist clone "$GIST_ID" "$TEMP_DIR"

cp "$TEMP_DIR"/*.json ~/.claude/
rm -rf "$TEMP_DIR"

echo "Done! Settings restored to ~/.claude/"
