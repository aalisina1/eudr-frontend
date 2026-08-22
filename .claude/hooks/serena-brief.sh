#!/usr/bin/env bash
# SessionStart hook — put Serena within reach BEFORE the first navigation call.
#
# Why this exists: the mcp__serena-* tools are DEFERRED. They are listed by name
# but carry no schema, so they are not callable until a session spends a
# ToolSearch on them. Grep/Read/Bash are always loaded and always cheaper in the
# moment, so "prefer Serena's symbolic tools" in CLAUDE.md lost every time:
# across ~13k logged tool calls in these repos, Serena was called ZERO times —
# including two sessions that loaded its schemas and then grepped anyway.
#
# Wired via this repo's .claude/settings.json (SessionStart). stdout -> context.
# Committed, so every worktree of this repo inherits it.
set -u

# Resolve the checkout we are actually in. CLAUDE_PROJECT_DIR is set by Claude
# Code; fall back to git so the hook still works if it is ever absent.
ROOT="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$ROOT" ] || [ ! -d "$ROOT" ]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
[ -n "$ROOT" ] || exit 0

# Which repo is this? Decide from the remote, fall back to marker files.
REMOTE="$(git -C "$ROOT" config --get remote.origin.url 2>/dev/null || true)"
case "$REMOTE" in
  *eudr-app*)      SERVER="serena-backend";  LANG_="python";     CANON="/Users/alisinaahmadi/dev/EUDR/eudr-backend"  ;;
  *eudr-frontend*) SERVER="serena-frontend"; LANG_="typescript"; CANON="/Users/alisinaahmadi/dev/EUDR/eudr-frontend" ;;
  *)
    # Remote missing or unrecognised — do not guess, use the marker files.
    if   [ -f "$ROOT/manage.py" ];      then SERVER="serena-backend";  LANG_="python";     CANON="/Users/alisinaahmadi/dev/EUDR/eudr-backend"
    elif [ -f "$ROOT/next.config.ts" ] || [ -f "$ROOT/next.config.js" ]; then
                                             SERVER="serena-frontend"; LANG_="typescript"; CANON="/Users/alisinaahmadi/dev/EUDR/eudr-frontend"
    else exit 0  # not an EUDR code repo — stay silent
    fi ;;
esac

P="mcp__${SERVER}__"

echo "=== SERENA (${SERVER}, ${LANG_}) — LOAD IT BEFORE YOUR FIRST grep/Read ==="
echo
echo "These tools are DEFERRED: listed by name, NO schema loaded, NOT callable yet."
echo "That is the whole reason past sessions defaulted to grep — at the moment of"
echo "the decision Serena was not in reach. Fetching the schemas is one call:"
echo
echo "  ToolSearch  query: \"select:${P}get_symbols_overview,${P}find_symbol,${P}find_referencing_symbols,${P}replace_symbol_body\""
echo
echo "IF THAT RETURNS NO MATCHES, Serena is NOT connected in this session."
echo "Say so out loud and use grep/Read — do not retry it silently. (Direct"
echo "sessions started inside this repo have no .mcp.json of their own; only"
echo "sessions that inherit the umbrella config at ~/dev/EUDR get the servers.)"
echo
echo "Once loaded, prefer:"
echo "  ${P}find_symbol            over  grep -n 'class Foo'"
echo "  ${P}get_symbols_overview   over  reading a whole file to see its shape"
echo "  ${P}find_referencing_symbols over grep -rn 'Foo(' to find call sites"
echo "  ${P}replace_symbol_body    over  Edit across a whole method body"
echo "Keep using grep/Read for non-symbol text: configs, migrations, fixtures,"
echo "docs, string literals. Serena indexes symbols, not prose."

# Worktree caveat: which checkout Serena indexes depends on which .mcp.json the
# session loaded. This repo's uses --project-from-cwd (correct per worktree);
# the umbrella one at ~/dev/EUDR pins absolute main-checkout paths.
if [ "$ROOT" != "$CANON" ]; then
  BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  echo
  echo "!! WORKTREE — you are in:"
  echo "     $ROOT  (branch: $BRANCH)"
  echo "   Which checkout ${SERVER} indexes depends on the config this session got:"
  echo "     - THIS repo's .mcp.json (--project-from-cwd) -> indexes this worktree. Correct."
  echo "     - the umbrella ~/dev/EUDR/.mcp.json (pinned)  -> indexes $CANON instead."
  echo "   Agent/teammate sessions spawned from the umbrella get the PINNED one."
  echo "   Tell them apart before trusting output: run ${P}get_symbols_overview on a"
  echo "   file that exists only on your branch. If it errors, or returns main's"
  echo "   content, you have the pinned server — orient with it, but verify line"
  echo "   numbers against your own files and do NOT apply a symbolic edit."
fi
