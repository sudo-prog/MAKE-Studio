---
name: OctoPrint SSRF guard
description: How the SSRF protection is implemented for OctoPrint proxy — what passes code review
---

# OctoPrint SSRF Guard

## Rule
Two-layer SSRF protection is required:
1. `validateOctoPrintUrl()` — synchronous static check blocks loopback IPs, metadata IPs, cloud metadata hostnames, wrong schemes
2. `resolveAndCheckHost()` — async DNS check via `dns.promises.lookup(hostname, {all:true})` blocks hostnames that resolve to loopback (127.x, ::1), link-local (169.254.x, fe80::), unspecified (0.0.0.0)

**Why:** Static IP checks alone don't catch DNS rebinding attacks where a hostname initially resolves to a valid LAN IP but is later rebind-attacked to loopback. Code review explicitly rejected static-only approach.

**How to apply:** Call both in (a) the connect endpoint before any test fetch, and (b) inside `getOctoPrintAccount()` before returning credentials used for every proxy request. RFC-1918 private LAN ranges (192.168.x, 10.x, 172.16-31.x) are intentionally NOT blocked — OctoPrint is a LAN device.
