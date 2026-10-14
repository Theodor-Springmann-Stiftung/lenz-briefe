#!/usr/bin/env python3
"""Publish lenz-briefe.de in one commit; run with --publish to go live.

Requires Python 3.10+, Git, authenticated GitHub CLI (gh), Node 24/npm and uv.
Also requires Git user.name/user.email and Python 3.13 for the site build.
From the repository root: python3 scripts/go_live.py --publish --tag v1.0.0
The launcher clones remote main; push any intended site changes before launch.
The gh account needs repository push and manage-Pages permissions.
Without --publish, prepares and prints the diff in a temporary clone only.
Use --https-only to finish certificate provisioning after a timed-out launch.
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
import subprocess
import tempfile
import time
import webbrowser

REPO = "Theodor-Springmann-Stiftung/lenz-briefe"
DOMAIN = "lenz-briefe.de"
URL = f"https://{DOMAIN}"
SETTINGS = f"https://github.com/{REPO}/settings/pages"
FILES = ["app/astro.config.mjs", "app/src/layouts/Layout.astro", "app/README.md", "assets/robots.txt"]


def run(*args: str, cwd: Path | None = None, capture: bool = False, data: str | None = None) -> str:
    executable = shutil.which(args[0])
    if not executable:
        raise RuntimeError(f"Required program is missing from PATH: {args[0]}")
    result = subprocess.run((executable, *args[1:]), cwd=cwd, input=data, text=True, encoding="utf-8",
                            stdout=subprocess.PIPE if capture else None, check=True)
    return result.stdout.strip() if capture else ""


def api(method: str = "GET", body: dict | None = None) -> dict:
    args = ["gh", "api", "--hostname", "github.com", "--method", method,
            f"repos/{REPO}/pages"]
    if body is not None:
        args += ["--input", "-"]
    output = run(*args, capture=True, data=json.dumps(body) if body is not None else None)
    return json.loads(output) if output else {}


def prepare(root: Path) -> list[str]:
    """Compute edits before writing; fail if the known launch inputs changed."""
    edits = {}
    config = root / FILES[0]
    old = config.read_text(encoding="utf-8")
    if "site: 'https://dev.lenz-briefe.de'" not in old and f"site: '{URL}'" not in old:
        raise RuntimeError("Unexpected Astro site setting; review it before launching.")
    edits[config] = old.replace("site: 'https://dev.lenz-briefe.de'", f"site: '{URL}'")

    layout = root / FILES[1]
    old = layout.read_text(encoding="utf-8")
    for name in ("robots", "googlebot"):
        old = old.replace(f'    <meta name="{name}" content="noindex, nofollow" />\n', "")
    if "noindex" in old or "nofollow" in old:
        raise RuntimeError("Unexpected indexing directive in Layout.astro; review it first.")
    edits[layout] = old

    readme = root / FILES[2]
    old = readme.read_text(encoding="utf-8")
    old = old.replace("GitHub Pages development deployment", "GitHub Pages production deployment")
    old = old.replace("dev.lenz-briefe.de", DOMAIN)
    old = old.replace("3. At the DNS provider, set the `dev` CNAME record to\n"
                      "   `theodor-springmann-stiftung.github.io` (no repository path).",
                      "3. At the DNS provider, point the apex (`@`) A records to\n"
                      "   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and\n"
                      "   `185.199.111.153` (GitHub Pages).")
    old = old.replace("The development site's `robots.txt` and `noindex` meta tags are included in the\n"
                      "published output.",
                      "The production site allows indexing: no blocking `robots.txt` is published,\n"
                      "and normal pages have no `noindex` directives. Redirect pages retain `noindex`.")
    if "`dev` CNAME" in old or "development site's" in old:
        raise RuntimeError("Deployment documentation has changed; review it before launching.")
    edits[readme] = old

    cmif = (root / "data/xslt/cmif.xsl").read_text(encoding="utf-8")
    if f"select=\"'{URL}'\"" not in cmif:
        raise RuntimeError("CMIF export must already use the production domain.")
    robots = root / FILES[3]
    if robots.exists() and robots.read_text(encoding="utf-8") != "# Development site: do not crawl.\nUser-agent: *\nDisallow: /\n":
        raise RuntimeError("robots.txt has changed; review it before removing it.")
    changed = []
    for path, content in edits.items():
        if path.read_text(encoding="utf-8") != content:
            path.write_text(content, encoding="utf-8")
            changed.append(str(path.relative_to(root)))
    if robots.exists():
        robots.unlink()
        changed.append(FILES[3])
    return changed


def enable_https(minutes: int) -> None:
    deadline = time.monotonic() + minutes * 60
    while True:
        settings = api()
        if settings.get("cname") != DOMAIN or settings.get("build_type") != "workflow":
            raise RuntimeError("Pages domain/source differs from the launch settings; stopping.")
        if settings.get("https_enforced"):
            print("HTTPS enforcement is enabled.", flush=True)
            return
        certificate = settings.get("https_certificate", {})
        if certificate.get("state") == "approved" and DOMAIN in certificate.get("domains", []):
            api("PUT", {"https_enforced": True})
            if not api().get("https_enforced"):
                raise RuntimeError("GitHub did not confirm HTTPS enforcement.")
            print("HTTPS enforcement enabled and verified.", flush=True)
            return
        if time.monotonic() >= deadline:
            raise RuntimeError("Certificate still pending. Launch changes remain published. "
                               "Later run: python3 scripts/go_live.py --https-only")
        print("Waiting for GitHub's HTTPS certificate (checking every 30 seconds)…", flush=True)
        time.sleep(30)


def watch_deployment(root: Path, sha: str) -> None:
    deadline = time.monotonic() + 300
    while time.monotonic() < deadline:
        runs = json.loads(run("gh", "run", "list", "--repo", REPO, "--workflow", "pages.yml",
                              "--branch", "main", "--commit", sha, "--event", "push",
                              "--json", "databaseId", capture=True, cwd=root))
        if runs:
            run("gh", "run", "watch", str(runs[0]["databaseId"]), "--repo", REPO,
                "--exit-status", cwd=root)
            return
        time.sleep(10)
    raise RuntimeError("Commit pushed, but no deployment run appeared within five minutes. "
                       f"Check https://github.com/{REPO}/actions before retrying.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--publish", action="store_true", help="build, commit, push and configure Pages")
    mode.add_argument("--https-only", action="store_true", help="resume HTTPS setup without creating a commit")
    parser.add_argument("--tag", help="annotated release tag, e.g. v1.0.0 (required with --publish)")
    parser.add_argument("--wait-minutes", type=int, default=30, help="certificate wait limit (default: 30)")
    args = parser.parse_args()
    if args.wait_minutes < 0:
        parser.error("--wait-minutes must be nonnegative")
    if args.publish and not args.tag:
        parser.error("--publish requires --tag, for example --tag v1.0.0")
    if args.tag:
        if args.tag.startswith("-"):
            parser.error("tag must not start with a dash")
        run("git", "check-ref-format", f"refs/tags/{args.tag}")
    run("gh", "auth", "status", "--hostname", "github.com")
    if args.https_only:
        enable_https(args.wait_minutes)
        webbrowser.open(SETTINGS)
        return
    # Explicit owner/repo and isolated main prevent publishing unrelated local edits.
    api()  # Confirm Pages can be read before doing any work.
    with tempfile.TemporaryDirectory(prefix="lenz-go-live-") as temp:
        root = Path(temp) / "site"
        run("gh", "repo", "clone", f"https://github.com/{REPO}", str(root), "--",
            "--branch", "main", "--single-branch")
        changed = prepare(root)
        tag_exists = False
        if args.publish:
            run("git", "var", "GIT_AUTHOR_IDENT", cwd=root, capture=True)
            run("git", "var", "GIT_COMMITTER_IDENT", cwd=root, capture=True)
            remote_tag = run("git", "ls-remote", "--tags", "origin",
                             f"refs/tags/{args.tag}", capture=True, cwd=root)
            tag_exists = bool(remote_tag)
            if tag_exists:
                if changed:
                    raise RuntimeError(f"Release tag {args.tag} already exists; choose a new tag.")
                run("git", "fetch", "origin", f"refs/tags/{args.tag}:refs/tags/{args.tag}", cwd=root)
                tag_sha = run("git", "rev-parse", f"refs/tags/{args.tag}^{{commit}}", cwd=root, capture=True)
                head = run("git", "rev-parse", "HEAD", cwd=root, capture=True)
                if tag_sha != head:
                    raise RuntimeError("Existing release tag does not point to current main; refusing to move it.")
        run("git", "diff", "--check", cwd=root)
        run("git", "diff", "--", *FILES, cwd=root)
        if not args.publish:
            print("Preview only. Nothing committed, pushed, or changed in GitHub.\n"
                  "To launch: python3 scripts/go_live.py --publish --tag v1.0.0")
            return
        if changed:
            run("npm", "--prefix", "app", "ci", cwd=root)
            run("uv", "sync", "--project", "scripts/transform/python", "--locked", cwd=root)
            run("npm", "--prefix", "app", "test", cwd=root)
            run("npm", "--prefix", "app", "run", "build", cwd=root)
            run("git", "add", "--", *changed, cwd=root)
            run("git", "commit", "-m", "CHORE: Launch lenz-briefe.de and allow indexing", cwd=root)
            sha = run("git", "rev-parse", "HEAD", cwd=root, capture=True)
        else:
            sha = run("git", "rev-parse", "HEAD", cwd=root, capture=True)
            print("Production code is already on main; no extra commit needed.", flush=True)
        if not tag_exists:
            run("git", "tag", "-a", args.tag, "-m", f"Launch {URL} ({args.tag})", sha, cwd=root)
        # Publish commit and tag together, or neither; never overwrite a remote tag.
        run("git", "push", "--atomic", "origin", "HEAD:main",
            f"refs/tags/{args.tag}:refs/tags/{args.tag}", cwd=root)
        print(f"Release pushed: {args.tag} at {sha}", flush=True)
        api("PUT", {"cname": DOMAIN, "build_type": "workflow"})
        settings = api()
        if settings.get("cname") != DOMAIN or settings.get("build_type") != "workflow":
            raise RuntimeError("GitHub did not confirm the requested Pages configuration.")
        print(f"Pages configured. Settings: {SETTINGS}", flush=True)
        webbrowser.open(SETTINGS)
        watch_deployment(root, sha)
        enable_https(args.wait_minutes)
        print(f"Pages configuration complete: {URL}\n"
              "Check the live site and DNS propagation. DNS and old-domain redirects are not modified.")


if __name__ == "__main__":
    try:
        main()
    except (subprocess.CalledProcessError, OSError, RuntimeError) as error:
        raise SystemExit(f"Stopped: {error}\n"
                         "Already-pushed commits and Pages settings are not rolled back. "
                         "Fix the reported issue, then rerun the same command to resume.")
