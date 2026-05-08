# Production Readiness Checklist

End-to-end checklist for deploying the fypApp ASD-Detection backend +
React Native frontend. Each item links to the PR that introduced the
underlying mechanism so you can audit "is this actually live in main?"
in one click.

> **Status legend** — ✅ shipped • 🟡 partial / config-required • 🔵
> follow-up tracked separately

---

## 1. Authentication & Authorization

| # | Item | Status | Source |
|---|------|--------|--------|
| 1.1 | Backend verifies a Firebase ID token on every `/api/assessment/*` endpoint | ✅ | PR #4 |
| 1.2 | The verified UID — not the request body — is the only source of identity | ✅ | PR #4 |
| 1.3 | Per-UID rate limits (12/min heavy, 60/min light) | ✅ | PR #6 |
| 1.4 | Token-expiry / revocation / invalid-token paths covered by pytest | ✅ | PR #9 |
| 1.5 | Frontend uses Firebase `onAuthStateChanged` as source of truth | ✅ | PR #7 |
| 1.6 | `lastLoginAt` audit field stamped on every sign-in | ✅ | PR #7 |
| 1.7 | Service-account JSON loaded from `ASD_FIREBASE_CREDENTIALS_PATH` *and* gitignored | 🟡 | needs deploy step |
| 1.8 | Role-based access control (admin / clinician / parent) | 🔵 | not in scope |

**Deploy step for 1.7** — drop the Firebase Admin service-account JSON
at the path referenced by `ASD_FIREBASE_CREDENTIALS_PATH` (or use
`GOOGLE_APPLICATION_CREDENTIALS` if you're on GCP). Confirm the file is
**not** in any image layer or git history before tagging a release.

## 2. Firestore Rules

| # | Item | Status | Source |
|---|------|--------|--------|
| 2.1 | Profile reads restricted to the owner UID | ✅ | PR #5 |
| 2.2 | Chat messages can only be edited / deleted by the author UID | ✅ | PR #5 |
| 2.3 | No dynamic collection names from user input | ✅ | PR #5 |
| 2.4 | Profile schema (uid, createdAt) is immutable after creation | ✅ | PR #5 |
| 2.5 | `lastLoginAt` / `updatedAt` allowed only via merge update | ✅ | PR #7 |
| 2.6 | Deny-by-default on every other path | ✅ | PR #5 |
| 2.7 | Rules verified by the Firestore emulator suite (76 cases on PR-D) | ✅ | PR #5 / #7 |

**Deploy step** — `firebase deploy --only firestore:rules` after every
PR that touches `firestore.rules`. Run the emulator tests in CI before
merging:

```
cd firestore-tests && \
  npx firebase --project=demo-fypapp-test \
    emulators:exec --only firestore 'npm test'
```

## 3. Transport Security & CORS

| # | Item | Status | Source |
|---|------|--------|--------|
| 3.1 | Strict CORS allow-list — wildcard rejected when `ASD_ENV=production` | ✅ | PR #4 |
| 3.2 | Allowed methods restricted (`GET`, `POST`, `OPTIONS`) | ✅ | PR #4 |
| 3.3 | Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) | ✅ | PR #4 |
| 3.4 | TLS termination handled by the platform (Cloud Run / fly.io / nginx) | 🟡 | infra |

**Deploy step for 3.4** — terminate TLS at the platform edge and route
to the FastAPI port over the internal mesh. The app itself does not
need to bind to HTTPS — it does need to trust the `X-Forwarded-Proto`
header so HSTS is set on https responses only. Set
`ASD_BEHIND_TLS_PROXY=true` once that's in place.

## 4. Payload & Upload Validation

| # | Item | Status | Source |
|---|------|--------|--------|
| 4.1 | Hard cap on request body size via `MaxBodySizeMiddleware` | ✅ | PR #4 |
| 4.2 | Magic-byte verification for audio (WAV/MP3/M4A only) | ✅ | PR #6 |
| 4.3 | Magic-byte verification for images (JPEG/PNG only) | ✅ | PR #6 |
| 4.4 | Mixed-format frame batches rejected | ✅ | PR #6 |
| 4.5 | Eye-tracking 14-feature physical-range guards | ✅ | PR #9 |
| 4.6 | NaN / inf rejection before model inference | ✅ | PR #2 |

## 5. Inference & ML Hardening

| # | Item | Status | Source |
|---|------|--------|--------|
| 5.1 | Per-call inference timeout (`ASD_INFERENCE_TIMEOUT_SECONDS`, default 45 s) | ✅ | PR #6 |
| 5.2 | Concurrency cap (`ASD_INFERENCE_MAX_CONCURRENT`, default 4) | ✅ | PR #6 |
| 5.3 | 504 returned on deadline; 503 + `Retry-After` on overload | ✅ | PR #6 |
| 5.4 | Out-of-distribution feature rows filtered before model.run() | ✅ | PR #9 |
| 5.4a | MediaPipe → trained-distribution domain adaptation (`EYE_TRACKING_PREPROC=domain_adapt`) | ✅ | PR-G |
| 5.5 | Trained-model artefact pinned in repo with `metadata.json` (label encoder + class index) | ✅ | PR #2 |
| 5.6 | NumPy-only forward pass — no TensorFlow / PyTorch in the runtime image | ✅ | PR #2 |
| 5.7 | Subprocess hard-cancel for inference | 🔵 | known follow-up |

> 5.7 is a known limitation — the current timeout is implemented via a
> `ThreadPoolExecutor`, which only **soft-cancels**. For pure-NumPy /
> librosa workloads this is acceptable (each call is bounded by
> matrix-mult cost). If a future model can hang for minutes on
> adversarial input, switch to a `multiprocessing.Process` with
> `terminate()`.

## 6. Observability & Logging

| # | Item | Status | Source |
|---|------|--------|--------|
| 6.1 | Structured JSON logging with env / service / version tags | ✅ | PR #8 |
| 6.2 | Per-request correlation id (`X-Request-ID`) in every log line | ✅ | PR #8 |
| 6.3 | Verified UID attached to every log line emitted post-auth | ✅ | PR #8 |
| 6.4 | Sensitive payloads (audio / frames / tokens) redacted before logging | ✅ | PR #8 |
| 6.5 | Live `/healthz` (liveness) and `/readyz` (deps green) endpoints | ✅ | PR #8 |
| 6.6 | External error tracking (Sentry / GCP Error Reporting) wired to the JSON logs | 🔵 | infra |

**Deploy step for 6.6** — configure your platform's log-based metrics
to alert on `level=ERROR` records. The redaction filter ensures it's
safe to forward the entire log stream to a third-party collector.

## 7. Storage & Audit Trail

| # | Item | Status | Source |
|---|------|--------|--------|
| 7.1 | SQLite assessments / reports tables include `created_at`, `updated_at`, soft-delete columns | ✅ | PR #5 |
| 7.2 | Soft-delete enforced via `DELETE /api/assessment/{id}` — 204 / 404 only | ✅ | PR #5 |
| 7.3 | Composite index on `(user_id, created_at)` for history queries | ✅ | PR #5 |
| 7.4 | All user data lives in Firestore (per Syed's design) | ✅ | confirmed in session 3 |
| 7.5 | Off-site backup of Firestore (daily export to GCS) | 🔵 | infra |

**Deploy step for 7.5** — `gcloud firestore export gs://<bucket>` on a
schedule via Cloud Scheduler.

## 8. Frontend Security

| # | Item | Status | Source |
|---|------|--------|--------|
| 8.1 | Auth state owned by Firebase (not React local state) | ✅ | PR #7 |
| 8.2 | Splash gate prevents AuthStack flash on cold start | ✅ | PR #7 |
| 8.3 | API client injects ID token automatically | ✅ | PR #4 |
| 8.4 | Logout flows through Firebase `signOut()` so listener handles state | ✅ | PR #7 |
| 8.5 | OAuth client IDs sourced from env vars (not hardcoded) | ✅ | PR #4 |
| 8.6 | Deep-link routes are protected | 🔵 | spot-check after RN nav refactor |

## 9. Pre-launch verification checklist

Run these from a clean machine after every release tag:

1. `poetry run pytest tests/ -q` → 0 failures.
2. `poetry run ruff check app/ tests/` → clean.
3. `cd firestore-tests && npx firebase --project=demo-fypapp-test emulators:exec --only firestore 'npm test'` → 0 failures.
4. `curl -fsS https://<host>/healthz | jq` → `{status: ok}`.
5. `curl -fsS https://<host>/readyz | jq` → `{status: ready, checks: {sqlite: ok, firebase_admin: ok}}`.
6. Sign in on a real device, capture an assessment, verify response contains the expected `model_features.summary` and the report is visible in Firestore under `users/<uid>/reports/<id>`.
7. Sign out, attempt to call `/api/assessment/mcq` with the now-stale token via `curl` — expect `401 unauthorized`.
8. Submit a request with a bogus `Authorization: Bearer foo.bar.baz` header — expect `401 unauthorized`.
9. POST a 50 MB audio payload — expect `413 payload_too_large`, *not* an OOM.
10. Hammer `/api/assessment/eye-tracking` with 30 requests in 60 s from one UID — expect at least one `429 rate_limited` with a `Retry-After` header.
11. Tail the production log stream — confirm **no** `audio_base64` / `frames_base64` / token values appear, every line carries `request_id`, post-auth lines carry `user_id`.

## 10. Known follow-ups (not blockers)

- Subprocess-based hard-cancel for inference (5.7).
- Retrain the eye-tracking model directly on MediaPipe-derived feature
  vectors using the original labels. PR-G (`EYE_TRACKING_PREPROC=domain_adapt`)
  bridges the trained eye-tracker decision boundary to the MediaPipe
  input distribution at inference time — the model's calibration on
  webcam data is therefore as good as the affine map. Retraining
  natively on MediaPipe vectors removes the bridge and would tighten
  decision-boundary calibration further.
- M-CHAT-R/F + AQ-10 questionnaire upgrade for the MCQ module.
- ASDSpeech-trained classifier for the speech module.
- Sentry / GCP Error Reporting wiring (6.6).
- Daily Firestore exports to GCS (7.5).
