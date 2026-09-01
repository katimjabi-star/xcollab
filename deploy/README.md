# Deploying xcollab to k2

Runbook for shipping xcollab (api + web, **sovereign profile**) to the
air-gapped, Argo CD-managed k2 cluster. Everything here is prepared in this
repo; a human executes the steps that touch shared infrastructure.

**Deploy discipline: `dev` only.** Promotions to `s`/`prod` happen only on
explicit instruction. Argo CD is authoritative — never `kubectl set image`
or `helm upgrade` against the cluster; drift is undone on the next sync.

## Ground truth — 2026-09-01 audit vs the live k2 deployments

Corrections made after reading the deployed mahara chart
(`X4Mahara/XMaharaServer/k8s/helm/mahara`) and the SecureSign repo
(`scm.katim.com/x-labs/ecorrespondence`:
`docs/deploy/k2-first-deploy-runbook.md` plus its `k2-deploy` skill):

- **Gateway**: the shared ingress Gateway is **`platform-gateway`**,
  referenced *unqualified* from the app namespace (both live charts do).
  This chart's default was corrected from `istio-system/main-gateway`.
- **Postgres is NOT in-cluster.** Both apps use the external DB VM
  (x4auth's server — `172.26.34.202` at audit time). Discover with
  `kubectl -n tasdiq-dev exec deploy/x4auth-server -- printenv DB_HOST`.
- **No shared Keycloak or MinIO exist.** The incumbent IdP is X4Auth;
  securesign runs its own MinIO. xcollab therefore ships both as
  dependency pods — see `deploy/dev-infra/` and section (d0).
- **Default deny-all Istio AuthorizationPolicy** in the tasdiq namespaces
  (STRICT mTLS mesh): sidecars 403 gateway traffic with nothing in app
  logs. The chart now ships selector-scoped ALLOWs
  (`templates/istio-authz.yaml`) and `deploy/dev-infra/authz-deps.yaml`
  covers the dependency pods.
- **Keycloak issuer is same-host path-routed**: `/auth/*` on the app host
  (`istio.virtualService.routeKeycloak`), because the in-app login form
  calls the token endpoint from the browser. Issuer =
  `https://<host>/auth/realms/xcollab` everywhere (KC_HOSTNAME, values,
  and the `NEXT_PUBLIC_KEYCLOAK_ISSUER` baked into the web image).
- **Access mechanics**: every k2 host needs `ProxyJump kps-jump` in
  `~/.ssh/config`; the Mac cannot reach the registry HTTP API (corp proxy
  resets `:5000`) — hence the rsync-then-build-on-k2-registry flow below.
  Sanity check the catalog from a k2 host:
  `curl -s http://172.26.34.205:5000/v2/_catalog`.
- **Public-plane alternative**: mahara's browser-facing host is
  `service3.nexedge.ae` on `platform-gateway`. If xcollab needs a
  non-VPN URL, request the next free `serviceN.nexedge.ae` slot from the
  platform team and set `istio.virtualService.host` (and re-bake the web
  image's `NEXT_PUBLIC_*` for that host).

## Isolation guarantees (k2 hosts other projects)

k2's `tasdiq-*` namespaces are shared with x4auth, mahara-server,
saf-recon, and redis. Everything in this directory is **strictly
additive** and cannot affect them:

- **NetworkPolicies select xcollab pods only** (label
  `app.kubernetes.io/part-of: xcollab` + name/instance). There is no
  namespace-wide (empty `podSelector`) policy anywhere in the chart — the
  default-deny applies to xcollab pods exclusively.
- **No namespace-level changes to shared namespaces.** The recommended
  target is a dedicated namespace per env (`xcollab-dev` / `xcollab-s` /
  `xcollab-prod`) that xcollab owns; only there do we apply the PSA label
  and (optionally) a ResourceQuota. Falling back to `tasdiq-*` requires
  no namespace change at all — the pod specs are PSA-restricted-compliant
  on their own, and `quota.enabled` stays `false`.
- **New, non-colliding names everywhere:** Argo CD Applications
  `xcollab-dev|s|prod`; image repos `infra/xcollab-api` and
  `infra/xcollab-web`; ingress host `xcollab.xedge-internal.corp`;
  build dir `k2-registry:/home/admin/xcollab-build/` (never another
  project's build dir).
- **k2-gitops changes are additions only:** a new `charts/xcollab/`, new
  `values/xcollab/<env>.yaml` files, and new `promote.sh` mapping ROWS —
  no existing chart, values file, or mapping row of any other service is
  edited.
- **Dedicated database.** xcollab gets its own `xcollab` database and
  roles; it never touches another project's database (see prerequisites).

## a) Build on the Mac + rsync to k2-registry

The k2-registry host has docker but **no npm access**, so all compilation
happens on the Mac; only prebuilt artifacts travel.

```bash
bin/k2-build.sh <descriptor>          # e.g. bin/k2-build.sh sovereign
bin/k2-build.sh <descriptor> --dry-run   # full build + staging, rsync -n to a local stand-in
```

The script:
1. builds `services/api/dist/server-sovereign.mjs` (`bin/build-api.sh
   sovereign`) and runs `bin/verify-sovereign.sh` (fails on any
   hosted-model code);
2. builds the Next.js standalone web output (`pnpm --filter @xcollab/web
   build`). **`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_KEYCLOAK_ISSUER`,
   `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` are baked here** — override them per
   env before running; the script prints what was baked;
3. stages both next to the k2-stage Dockerfiles
   (`deploy/docker/{api,web}.Dockerfile`, which copy artifacts only and
   run **no package manager**), pruning the darwin-arm64 sharp binaries
   that cannot load in a linux/amd64 pod;
4. rsyncs the stage to `k2-registry:/home/admin/xcollab-build/{api,web}/`
   (excludes are **anchored with a leading `/`** — a bare
   `--exclude='node_modules'` would silently drop
   `web/standalone/node_modules`, which must ship);
5. prints — never executes — the build/push/promote commands below, with
   `TAG=v0.1-<descriptor>-<git short sha>`. Tags are **never reused**
   (`imagePullPolicy: IfNotPresent` would silently keep the old image).

## b) Build + push on k2-registry (human-run)

`sudo` is required for docker on k2-registry. With `TAG` as printed by
`bin/k2-build.sh`:

```bash
ssh k2-registry "sudo docker build --platform=linux/amd64 \
  -t 172.26.34.205:5000/infra/xcollab-api:$TAG /home/admin/xcollab-build/api \
  && sudo docker push 172.26.34.205:5000/infra/xcollab-api:$TAG"

ssh k2-registry "sudo docker build --platform=linux/amd64 \
  -t 172.26.34.205:5000/infra/xcollab-web:$TAG /home/admin/xcollab-build/web \
  && sudo docker push 172.26.34.205:5000/infra/xcollab-web:$TAG"
```

`node:20-slim` is already cached on k2-registry; these Dockerfiles pull
nothing else and run no package manager, so they build fully air-gapped.

## c) k2-gitops adoption (one-time, additive only)

In `~/workspace/k2-gitops`
(`ssh://git@bitbucket.katim.com:7999/pi/k2-gitops.git`):

1. **Chart**: copy `deploy/chart/xcollab/` from this repo to
   `charts/xcollab/` (or wherever sibling charts live — match x4auth's
   layout). Do not modify any existing chart.
2. **Values**: copy `deploy/values/xcollab/{dev,s,prod}.yaml` to
   `values/xcollab/dev.yaml`, `values/xcollab/s.yaml`,
   `values/xcollab/prod.yaml`. Confirm the backend Service DNS names
   (postgres/minio/keycloak placeholders) with the platform team.
3. **Argo CD Applications** (one per env; new names, no collision with
   existing apps). Ready to paste — adjust `repoURL` path and the chart
   `path` to the repo's actual conventions:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: xcollab-dev
  namespace: argocd
spec:
  project: default
  source:
    repoURL: ssh://git@bitbucket.katim.com:7999/pi/k2-gitops.git
    targetRevision: HEAD
    path: charts/xcollab
    helm:
      valueFiles:
        - ../../values/xcollab/dev.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: xcollab-dev        # dedicated ns (recommended); tasdiq-dev as fallback
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=false     # namespace pre-created with labels, see prerequisites
```

For `s`/`prod`, duplicate with `name: xcollab-s` / `xcollab-prod`,
`valueFiles: ../../values/xcollab/s.yaml` / `prod.yaml`, and
`namespace: xcollab-s` / `xcollab-prod` (fallback `tasdiq-s` /
`tasdiq-prod`). Match the sibling apps' `syncPolicy` if they differ
(tasdiq-dev is known not to auto-sync reliably — see (e)).

4. **promote.sh mapping — rows ADDED** (edit no existing rows):

   | service | chart | values path |
   |---|---|---|
   | `xcollab-api` | xcollab | `.api.image.tag` |
   | `xcollab-web` | xcollab | `.web.image.tag` |

5. **Promote** (dev only):

```bash
cd ~/workspace/k2-gitops
bin/promote.sh xcollab-api dev "$TAG"
bin/promote.sh xcollab-web dev "$TAG"
```

## d) In-cluster prerequisites (per env, before first sync)

1. **Namespace** (dedicated, recommended):

```bash
kubectl create namespace xcollab-dev
kubectl label namespace xcollab-dev \
  pod-security.kubernetes.io/enforce=restricted \
  istio-injection=enabled
```

   Never apply the PSA label to a shared `tasdiq-*` namespace. Fallback
   to `tasdiq-dev` = skip this step entirely.

2. **Secret** `xcollab-api` (name is `api.existingSecret` in values; the
   chart renders **no** Secret and carries no secret material). Exact keys:

   | key | content |
   |---|---|
   | `DATABASE_URL` | postgres URL, admin/migration role, `xcollab` DB |
   | `APP_DATABASE_URL` | postgres URL, runtime `xcollab_app` role, `xcollab` DB |
   | `KEYCLOAK_SVC_CLIENT_ID` | service-account client id (realm `xcollab`) |
   | `KEYCLOAK_SVC_CLIENT_SECRET` | its client secret |
   | `MINIO_ACCESS_KEY` | MinIO access key |
   | `MINIO_SECRET_KEY` | MinIO secret key |

```bash
kubectl -n xcollab-dev create secret generic xcollab-api \
  --from-literal=DATABASE_URL='postgresql://xcollab:<pw>@<pg-host>:5432/xcollab' \
  --from-literal=APP_DATABASE_URL='postgresql://xcollab_app:<pw>@<pg-host>:5432/xcollab' \
  --from-literal=KEYCLOAK_SVC_CLIENT_ID='xcollab-svc' \
  --from-literal=KEYCLOAK_SVC_CLIENT_SECRET='<secret>' \
  --from-literal=MINIO_ACCESS_KEY='<key>' \
  --from-literal=MINIO_SECRET_KEY='<secret>'
```

3. **Database — dedicated, never shared.** Do not reuse another project's
   database. On the Postgres host that serves the env (k2-db if that is
   the pattern), create xcollab's own DB and roles; requires the
   **pgvector** extension:

```sql
CREATE ROLE xcollab LOGIN PASSWORD '<pw>';       -- admin/migrations
CREATE ROLE xcollab_app LOGIN PASSWORD '<pw>';    -- runtime, least-privilege
CREATE DATABASE xcollab OWNER xcollab;
\c xcollab
CREATE EXTENSION IF NOT EXISTS vector;            -- pgvector 16+ required
```

4. **Backing services — ground truth (see audit section):** Postgres is
   the external DB VM (`backends.postgres.host`; pgvector required).
   Keycloak and MinIO do NOT exist on k2 — deploy them from
   `deploy/dev-infra/` (section d0) before the first Argo sync, then point
   `backends.*` at their Services. Ollama optional.

5. **Non-secret env** (`KEYCLOAK_ISSUER`, MinIO endpoint, CORS origins,
   Ollama toggle) comes from the chart's ConfigMap via the same
   `backends.*` / `api.env.*` values.

## d0) Dependency pods — first deploy only (Keycloak + MinIO)

Same pattern as SecureSign's Phase 2 (their dev Vault/MinIO pods). All
manifests are PSA-restricted-compliant and label-scoped to xcollab.

1. **Carry the images** (add to the section (a)/(b) tar run):

```bash
# on the Mac
docker pull --platform linux/amd64 quay.io/keycloak/keycloak:26.0 \
  && docker save quay.io/keycloak/keycloak:26.0 -o out/keycloak.tar
docker pull --platform linux/amd64 minio/minio:latest \
  && docker save minio/minio:latest -o out/minio.tar
# on k2-registry (after scp): load, retag to
# 172.26.34.205:5000/infra/keycloak:26.0 and .../infra/minio:latest, push.
# minio may already be in the catalog from securesign — check first.
```

2. **Secrets (out of band, never in git):**

```bash
kubectl -n xcollab-dev create secret generic xcollab-keycloak-admin \
  --from-literal=KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  --from-literal=KC_BOOTSTRAP_ADMIN_PASSWORD='<strong pw>'
kubectl -n xcollab-dev create secret generic xcollab-minio-root \
  --from-literal=MINIO_ROOT_USER=xcollab-root \
  --from-literal=MINIO_ROOT_PASSWORD='<strong pw>'
```

3. **Apply + wait:**

```bash
kubectl -n xcollab-dev apply -f deploy/dev-infra/keycloak.yaml \
  -f deploy/dev-infra/minio.yaml -f deploy/dev-infra/authz-deps.yaml
kubectl -n xcollab-dev rollout status deploy/xcollab-keycloak --timeout=180s
kubectl -n xcollab-dev rollout status deploy/xcollab-minio --timeout=120s
```

4. **Bootstrap the realm** — `keycloak/bootstrap-dev.sh` is already
   parameterized (`KEYCLOAK_URL`); run it against a port-forward, then fix
   the client's redirect/web origins for the real host in the admin
   console (the script bakes localhost:3000 values):

```bash
kubectl -n xcollab-dev port-forward deploy/xcollab-keycloak 8081:8080 &
KEYCLOAK_URL=http://localhost:8081/auth KC_BOOTSTRAP_ADMIN_PASSWORD='<pw>' \
  keycloak/bootstrap-dev.sh
# then: realm xcollab -> client xcollab-web -> redirectUris/webOrigins =
# https://xcollab.xedge-internal.corp/* ; create real users (no demo/demo).
```

5. **MinIO app user + bucket** — run the `mc` block from the header
   comment of `deploy/dev-infra/minio.yaml`, with the same access/secret
   pair you put in the `xcollab-api` Secret.

Dev-posture caveats (both pods): emptyDir storage — Keycloak realm state
and MinIO objects die with the pod. Before `s`: Keycloak → `KC_DB=postgres`
on the xcollab database, MinIO → PVC.

## e) tasdiq-dev manual sync workaround

`promote.sh` can report success while its Argo CD sync call fails (TLS EOF
reaching `argocd.xedge-internal.corp` from the Mac). If
`argocd app get xcollab-dev` shows `OutOfSync`, sync from k2-master:

```bash
ssh k2-master "kubectl patch application xcollab-dev -n argocd --type merge -p \
  '{\"operation\":{\"initiatedBy\":{\"username\":\"admin\"},\"sync\":{\"revision\":\"HEAD\",\"syncOptions\":[\"ServerSideApply=true\"]}}}' \
  && kubectl rollout status deploy/xcollab-api -n xcollab-dev --timeout=90s"
```

## f) Rollback

Same GitOps flow, previous tag (find it in
`git log --oneline -- values/xcollab/dev.yaml`):

```bash
cd ~/workspace/k2-gitops
bin/promote.sh xcollab-api dev <previous-tag>
bin/promote.sh xcollab-web dev <previous-tag>
```

Tags embed the short SHA and are never reused, so the previous tag always
points at the exact prior image. Apply the manual-sync workaround above if
dev does not pick it up.

## Chart notes

- **PSA restricted** on every pod: `runAsNonRoot`, `runAsUser: 10001`,
  `seccompProfile: RuntimeDefault`, `allowPrivilegeEscalation: false`,
  `capabilities: drop [ALL]`, `readOnlyRootFilesystem: true` with
  emptyDir mounts at `/tmp` (both) and `/app/apps/web/.next/cache` (web —
  Next writes its cache there; verified in the local smoke test).
- **Probes**: api `GET /api/health` (unauthenticated); web `GET /`.
- **NetworkPolicy** (xcollab-pods-only default-deny + allows): istio
  ingress-gateway→web:3000 and →api:4000 (`api.exposeViaGateway`),
  web→api:4000, api→postgres:5432 / minio:9000 / keycloak:8080 /
  ollama:11434 (`backends.ollama.enabled`), DNS 53 UDP+TCP. Pods carry
  istio sidecars: if the CNI enforces policy on sidecar traffic, keep
  `istio.networkPolicyControlPlane.enabled: true` (egress to istiod
  :15012, ingress :15020/:15021/:15090); disable only if istio traffic is
  exempted cluster-wide.
- **Exposure**: istio `VirtualService` on `xcollab.xedge-internal.corp`
  (`/api/*` → api, rest → web), gated by `istio.virtualService.enabled`;
  a plain `Ingress` alternative is gated by `ingress.enabled`.
