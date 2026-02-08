#!/bin/bash
# Install MCP servers for Claude Code
# Run this after restore-claude-settings.sh

set -e

echo "Installing MCP servers..."

# HTTP-based MCP servers (just need to add, auth happens in Claude)
claude mcp add --transport http vercel https://mcp.vercel.com
claude mcp add --transport http linear-server https://mcp.linear.app/mcp
claude mcp add --transport http context7 https://mcp.context7.com/mcp
claude mcp add --transport http supabase https://mcp.supabase.com/mcp

# NPX-based MCP servers
claude mcp add playwright -- npx @playwright/mcp@latest

echo ""
echo "Done! MCP servers installed."
echo ""
echo "Next steps:"
echo "  1. Start Claude: claude"
echo "  2. Run /mcp to authenticate servers that need it"
echo "  3. Vercel, Linear, Supabase will prompt for OAuth"
