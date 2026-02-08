#!/bin/bash
# Install MCP servers for Claude Code
# Run this after restore-claude-settings.sh

set -e

echo "Installing MCP servers..."

# HTTP-based MCP servers (just need to add, auth happens in Claude)
claude mcp add vercel --transport http --url https://mcp.vercel.com
claude mcp add linear-server --transport http --url https://mcp.linear.app/mcp
claude mcp add context7 --transport http --url https://mcp.context7.com/mcp
claude mcp add supabase --transport http --url https://mcp.supabase.com/mcp

# NPX-based MCP servers
claude mcp add playwright -- npx @playwright/mcp@latest

echo ""
echo "Done! MCP servers installed."
echo ""
echo "Next steps:"
echo "  1. Start Claude: claude"
echo "  2. Run /mcp to authenticate servers that need it"
echo "  3. Vercel, Linear, Supabase will prompt for OAuth"
