# Security

## What this project handles

`cdp auth export` reads **cookies** and **`localStorage`** from a browser the user controls, and `auth import` writes them into another profile. Those values are authentication material:

- cookies can be replayed as the user, including `HttpOnly` ones;
- `localStorage` commonly holds bearer and refresh tokens;
- the target profile directory stores the same material on disk.

The tool does not send data anywhere: both WebSocket connections are local connections to the two browsers.

## Rules

- `auth export --out` writes with mode `0600` on POSIX; Windows inherits the ACL of the parent directory.
- Prefer `auth sync`, which keeps the payload in memory and writes no file.
- Never commit an auth file (`.gitignore` covers `auth*.json`), never paste it into an issue, delete it when done.
- Use a throwaway `--profile` directory and remove it afterwards.
- Do not point `--profile` at the daily browser profile: the launch will fail or hand off, and the intent is wrong either way.
- The "Allow remote debugging?" prompt is a security boundary. Approve it deliberately; do not automate it.

## Out of scope

- Device-bound sessions, WebAuthn, risk engines and IP checks may still require re-verification after the move. CDP cannot change that.
- No service worker caches, IndexedDB, extensions, history or HTTP auth cache are copied.

## Reporting

Open a private security advisory on the repository, or email the maintainer in `package.json`. Do not file a public issue for a vulnerability that exposes credentials.