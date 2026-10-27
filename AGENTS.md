# OnlyFast working directory and Git workflow

- Use the primary checkout at
  `C:\Users\c_mar\OneDrive\Desktop\Apex88\OnlyFast\App\racing-setup-dirt (1)\onlyfast`.
- Before editing, check the working directory, `git status --short --branch`,
  `git branch --show-current`, and `git remote -v`.
- Work on the current `main` branch in this directory for normal development.
  Preserve local changes and reconcile remote changes safely before editing.
- Do not create another Git worktree or feature branch unless the user explicitly
  asks for one. Do not switch or edit another worktree as a routine workaround.
- Keep commits and authorized pushes associated with `Apex88Vent/onlyfast`.
- Git pushes can trigger Vercel deployments. A request that prohibits deployment
  does not authorize triggering one through a push; resolve that constraint first.
- Preserve existing worktrees, branches and recovery backups until the user
  explicitly approves their removal. Never force push or discard uncommitted work.
- Follow the stock Median paywall release plan for active billing. Custom native
  bridge sources are retained historical development material; see `native/README.md`.
- Production advertising and purchasing holds must remain in place unless the
  user separately requests their reviewed activation.
