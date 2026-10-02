#!/bin/sh
# Privacy guard: keeps personal emails, private local paths and secrets out of what gets published.
# It never prints the offending text (CI logs of a public repo are public), only where it is.
#
#   check-privacy.sh --identity        the author/committer git would use for the next commit
#   check-privacy.sh --staged          the staged changes
#   check-privacy.sh --message FILE    a commit message file
#   check-privacy.sh --tree            every tracked file as it is now
#   check-privacy.sh <rev-list args>   author/committer, message and added lines of each commit in the range
#                                      (HEAD = the whole history, origin/main..HEAD = what a push adds)
#
# Private terms (your user name, a private project name, a personal email...) go one per line in
#   ~/.git-privacy-terms     all your repos
#   .git/privacy-terms       this repo only (inside .git, so never pushed)
# CI cannot read those files: it only applies the generic rules below.
#
# A line that holds an invented example (a fake path in a test, say) can carry the marker  privacy-ok  in a comment.

# Emails that may appear: GitHub noreply, the Co-Authored-By trailer, documentation examples.
allowed='(@users[.]noreply[.]github[.]com|^noreply@(github|anthropic)[.]com|@example[.](com|org|net))$'
# Files whose content is generated and full of email-like text.
skip='(^|/)(package-lock[.]json|yarn[.]lock|pnpm-lock[.]yaml)$'
global_terms="$HOME/.git-privacy-terms"
repo_terms=$(git rev-parse --git-path privacy-terms 2>/dev/null)

# stdin: a diff (mode "diff") or plain text (mode "text"). "@@commit <id>" lines mark where a commit starts.
scan() {
  awk -v mode="$1" -v allowed="$allowed" -v skip="$skip" -v termfiles="$global_terms|$repo_terms" '
  BEGIN {
    n = split(termfiles, tf, "|")
    for (i = 1; i <= n; i++)
      while ((getline t < tf[i]) > 0) {
        gsub(/\r/, "", t); t = tolower(t)
        if (length(t) >= 3) terms[++nt] = t
      }
  }
  function report(kind,   key) {
    key = c SUBSEP f SUBSEP line SUBSEP kind
    if (key in seen) return
    seen[key] = 1
    printf "%s%s%s: %s\n", (c != "" ? "commit " c ", " : ""), (f != "" ? f : "message"), \
      (line != "" ? ":" line : ""), kind > "/dev/stderr"
    bad = 1
  }
  # a match that is not in the middle of a word
  function standalone(s, extra) {
    return RSTART == 1 || substr(s, RSTART - 1, 1) !~ extra
  }
  function check(s,   t, m, i) {
    if (index(s, "privacy-ok") > 0) return   # deliberate: an invented example, marked by its author
    t = s
    while (match(t, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z][A-Za-z]+/)) {
      m = tolower(substr(t, RSTART, RLENGTH))
      if (m !~ allowed) report("email address")
      t = substr(t, RSTART + RLENGTH)
    }
    # drive paths with a backslash, a doubled backslash (escaped in a string) or a slash; not http://
    if (match(s, /[A-Za-z]:\\+[A-Za-z0-9_.-]/) && standalone(s, "[A-Za-z0-9]")) report("local Windows path")
    else if (match(s, /[A-Za-z]:\/[A-Za-z0-9_.-]/) && standalone(s, "[A-Za-z0-9]")) report("local Windows path")
    if (match(s, /\/Users\/[A-Za-z0-9_.-]+\//) && standalone(s, "[A-Za-z0-9.]")) report("local user path")
    if (match(s, /(ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]+/) && RLENGTH >= 36) report("GitHub token")
    if (match(s, /github_pat_[A-Za-z0-9_]+/) && RLENGTH >= 40) report("GitHub token")
    if (match(s, /AKIA[0-9A-Z]+/) && RLENGTH >= 20) report("AWS key")
    if (match(s, /sk-ant-[A-Za-z0-9_-]+/) && RLENGTH >= 20) report("Anthropic key")
    if (s ~ /-----BEGIN [A-Z ]*PRIVATE KEY-----/) report("private key")
    s = tolower(s)
    for (i = 1; i <= nt; i++) if (index(s, terms[i])) { report("private term"); break }
  }
  /^@@commit / { c = $2; f = ""; line = ""; next }
  mode == "diff" {
    if ($0 ~ /^\+\+\+ /) { f = ($0 == "+++ /dev/null") ? "" : substr($0, 7); line = ""; next }
    if ($0 ~ /^@@ /) { if (match($0, /\+[0-9]+/)) line = substr($0, RSTART + 1, RLENGTH - 1) + 0; next }
    if ($0 ~ /^\+/) { if (f !~ skip) check(substr($0, 2)); if (line != "") line++ }
    next
  }
  { check($0) }
  END { exit bad }'
}

case "$1" in
  --identity)
    status=0
    for role in AUTHOR COMMITTER; do
      email=$(git var "GIT_${role}_IDENT" | sed -n 's/.*<\(.*\)>.*/\1/p' | tr 'A-Z' 'a-z')
      if ! printf '%s\n' "$email" | grep -Eq "$allowed"; then
        echo "Blocked: the git $role email is not a GitHub noreply address." >&2
        status=1
      fi
    done
    [ "$status" -ne 0 ] && echo 'Fix:  git config user.email "<id>+<user>@users.noreply.github.com"' >&2
    exit "$status"
    ;;
  --staged)
    { echo "@@commit staged"; git diff --cached --no-color -U0; } | scan diff
    ;;
  --tree)
    { echo "@@commit tree"; git diff --no-color -U0 "$(git hash-object -t tree -w /dev/null)"; } | scan diff
    ;;
  --message)
    grep -v '^#' "$2" | scan text
    ;;
  *)
    status=0
    bad=$(git log --format='%h %ae %ce' "$@" | awk -v re="$allowed" '
      tolower($2) !~ re { print "commit " $1 ": author email is not a noreply address" }
      tolower($3) !~ re { print "commit " $1 ": committer email is not a noreply address" }')
    if [ -n "$bad" ]; then echo "$bad" >&2; status=1; fi
    git log --format='@@commit %h%n%B' "$@" | scan text || status=1
    git log -p -U0 --no-color --format='@@commit %h' "$@" | scan diff || status=1
    if [ "$status" -ne 0 ]; then
      echo "Rewrite or fix these before they are published (history stays public once pushed)." >&2
    fi
    exit "$status"
    ;;
esac
