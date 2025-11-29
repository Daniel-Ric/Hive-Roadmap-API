# Security Policy

## Project
Hive-Roadmap-API  
Repository: https://github.com/Daniel-Ric/Hive-Roadmap-API

---

## Supported Versions

The following versions receive security-related fixes:

| Version                             | Security Fixes Provided           |
|-------------------------------------|-----------------------------------|
| `main` branch (current development) | ✅                                |
| Tags/releases named `vX.Y.Z`        | ✅ if not marked end-of-life      |
| Forks / heavily modified copies     | ❌ (best-effort guidance only)    |

If you are running a fork or a significantly modified version, I may not be able to provide a direct patch for you. You are still encouraged to report vulnerabilities so they can be fixed upstream.

---

## What Is Considered a Security Issue

Please report anything that could impact the confidentiality, integrity, or availability of data, users, or systems that interact with this API. For example:

### Authentication / Authorization (if enabled in your deployment)
- Bypassing authentication or access controls applied around the API
- Escalating privileges to perform actions you should not be allowed to do
- Accessing sensitive debug functionality without permission

> Note: The reference implementation of Hive-Roadmap-API is **read-only** over public Hive roadmap data and does not ship with built-in user authentication. However, many deployments wrap it with gateways, API keys or JWTs. Bugs that allow bypassing such protections in this project are still in scope.

### Data Exposure / Integrity

Even though the API consumes **public** roadmap data, the following are still security issues:

- Reading additional, non-public data from upstream services due to incorrect configuration
- Modifying or deleting data in upstream services (Featurebase / The Hive) through this API
- Secrets, tokens, API keys, credentials or other sensitive values being exposed in:
  - Source code or config
  - Logs
  - HTTP responses (headers or body)

### Code Execution / Injection

- Remote Code Execution (RCE) on the Node.js process or host
- Command injection (e.g. in hooks or shell calls)
- Deserialization attacks
- Any form of injection including template, NoSQL, or other dynamic-parameter injection that can be exploited via this API

### Denial of Service

- Inputs that can intentionally crash the service or make it unavailable with a realistic request pattern
- Algorithmic complexity attacks on JSON parsing, aggregation, or normalization (especially in `/roadmap/aggregate`)
- Abuse of webhooks that causes resource exhaustion or uncontrolled outbound traffic

### Input Handling

- Unsafe or missing validation of user input that can be used to:
  - Break out of expected control flow
  - Trigger SSRF (Server-Side Request Forgery) through webhook URLs or other outbound requests
- Directly forwarding untrusted input to external services, system commands, or internal services without sanitization

### Insecure Configuration

- Insecure default configuration that would likely be used in production by mistake
- Missing transport security assumptions (e.g. recommending plaintext for sensitive webhook endpoints)
- CORS configuration that unintentionally exposes internal deployments to untrusted origins

---

## Out of Scope

The following are generally **not** treated as security vulnerabilities (but they can still be filed as normal GitHub issues):

- Typos, dead links, grammar issues, or comments in code
- Theoretical attacks that require unrealistic conditions and have no practical impact
- Extremely high request volumes that are obviously abusive and not representative of real-world traffic
- Vulnerabilities in upstream Hive/Featurebase services (those should be reported to their owners)
- Issues in third-party dependencies that:
  - are not actually reachable in normal use of this project, or
  - only apply if you deliberately misconfigure the project in a way it is not intended to be run
- Issues that only affect a local development environment which is already fully trusted and under your control

If you are unsure whether something is in scope, please still get in touch privately (see below).

---

## How To Report a Vulnerability

**Do not open a public GitHub issue with exploit details.**

Instead, please report privately using one of these methods:

1. **Preferred:** Contact me directly on Discord  
   User: `discord.com/users/252138923952832523`

2. **If Discord is not possible:**  
   You may open a GitHub issue in the repository with a title beginning with  
   `SECURITY:`  
   and include a way for me to contact you (for example your Discord username).  
   Do **not** include full exploit details in the public issue. Just let me know that you believe you found a security problem.

### Your report should include:

- A clear description of the issue
- Which part of the project is affected (file, endpoint, function, etc.)
- Exact steps to reproduce the issue
- What you expected to happen
- What actually happened
- The potential impact (for example: “unauthorized read of non-public data”, “service crash”, “remote code execution”, “SSRF via webhooks”, etc.)
- A minimal proof-of-concept request or payload, if you have one
- Any logs, stack traces, or screenshots that might help reproduce the problem

The more specific the report, the faster I can reproduce and confirm it.

---

## Disclosure Policy

- Please give me reasonable time to investigate, fix, and release a patch before sharing details publicly.
- After the issue is fixed, I may document the fix in release notes or commit messages. I will not include sensitive exploit details that make it easy to attack users who haven't updated yet.
- If the issue is in a third-party library, I may coordinate with that project’s maintainers as well.

### Credit

- If you would like public credit for discovering the issue, tell me in your report (and how you would like to be credited).
- If you prefer to stay anonymous, say that instead. I will respect that.

---

## Handling of Leaked Secrets

Hive-Roadmap-API may integrate with:

- Upstream Hive/Featurebase hosts
- Reverse proxies, gateways, or additional monitoring systems
- Your own authentication or analytics backend

These integrations may rely on credentials (API keys, tokens, etc.). Protecting those secrets is critical.

If you discover exposed credentials (for example in source code, commit history, configuration files, or logs):

1. Contact me privately on Discord at `discord.com/users/252138923952832523`.
2. Do **not** post the secret in a public issue, pull request, screenshot, or anywhere else public.
3. If the secret is clearly associated with your environment, immediately rotate/revoke it yourself.
4. I will rotate any secrets controlled by me and clean up the repository history if required.

---

## Security Practices in This Project

The Hive-Roadmap-API codebase aims to follow these principles:

- **No secrets committed to the repository.**  
  Configuration such as upstream tokens or webhook secrets should be provided through environment variables (e.g. `.env`), which are not committed.

- **Least privilege.**  
  Any credentials used for upstream communication should be limited to read-only access to public endpoints wherever possible. The reference implementation only queries public Hive roadmap endpoints.

- **Validation and sanitization.**  
  Inputs (especially webhook registration data and query parameters) should be validated before being used internally or forwarded to other services.

- **Dependency hygiene.**  
  Dependencies should be kept reasonably up to date, and high-impact security vulnerabilities in dependencies will be addressed once identified.

- **Fail-closed behavior.**  
  On configuration or validation errors, the server should prefer to fail and log an error instead of silently continuing with an insecure configuration.

If you notice a part of the codebase that clearly violates these principles, that is worth reporting privately as a security concern.

---

## Proof-of-Concept / Exploit Testing

You are allowed to create proof-of-concept payloads or requests **only** under the following conditions:

- You test against your **own** local or development environment.
- You are not attacking infrastructure, accounts, or data that you do not own or control.
- You do not attempt to access data belonging to other people without permission.
- You do not intentionally perform large-scale denial-of-service testing against someone else’s environment.
- For SSRF-style tests (e.g. via webhook URL), you use endpoints that you own and operate.

A simple “I believe I can do X by sending Y” is enough for a report. You do not need to demonstrate real damage.

---

## Final Notes

Security reports are extremely valuable, whether the issue is critical (like remote code execution) or more subtle (like being able to redirect webhook requests to arbitrary hosts).

If you are unsure whether something is in scope, assume it might be and contact me privately on Discord:  
`discord.com/users/252138923952832523`.

Thank you for helping keep Hive-Roadmap-API safe for everyone who uses it.
