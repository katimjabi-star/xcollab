#!/usr/bin/env bash
# Re-bootstrap the xcollab realm (dev-only credentials) incl. the branded login theme.
set -e
KC=${KEYCLOAK_URL:-http://localhost:8081}
ADMIN_PASSWORD=${KC_BOOTSTRAP_ADMIN_PASSWORD:-admin_dev_only}
TOKEN=$(curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=admin-cli&username=admin&password=$ADMIN_PASSWORD" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).access_token))")
AUTH="Authorization: Bearer $TOKEN"

echo -n "realm: "
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$KC/admin/realms" -H "$AUTH" -H "Content-Type: application/json" -d '{
  "realm": "xcollab", "enabled": true, "registrationAllowed": false,
  "displayName": "XCollab",
  "displayNameHtml": "<div class=\"xc-logo\"><span class=\"xc-logo-x\">X</span><span>Colla</span><span class=\"xc-logo-b\">b</span></div>",
  "loginTheme": "xcollab",
  "internationalizationEnabled": true, "supportedLocales": ["en", "ar"], "defaultLocale": "en"
}'

echo -n "client: "
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$KC/admin/realms/xcollab/clients" -H "$AUTH" -H "Content-Type: application/json" -d '{
  "clientId": "xcollab-web", "publicClient": true, "standardFlowEnabled": true,
  "directAccessGrantsEnabled": true, "redirectUris": ["http://localhost:3000/*"],
  "webOrigins": ["http://localhost:3000"],
  "attributes": {"pkce.code.challenge.method": "S256", "post.logout.redirect.uris": "http://localhost:3000/*"}
}'

# Confidential service client for the api's realm-user directory listing
# (services/api/src/users.ts) — replaces the master-realm admin password grant.
# Its service account gets exactly the realm-management view-users role.
SVC_SECRET=${KEYCLOAK_SVC_CLIENT_SECRET:-svc_dev_only}
echo -n "svc client: "
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$KC/admin/realms/xcollab/clients" -H "$AUTH" -H "Content-Type: application/json" -d "{
  \"clientId\": \"xcollab-svc\", \"publicClient\": false, \"serviceAccountsEnabled\": true,
  \"standardFlowEnabled\": false, \"directAccessGrantsEnabled\": false,
  \"secret\": \"$SVC_SECRET\"
}"

first_id() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d)[0].id))"; }
SVC_ID=$(curl -s "$KC/admin/realms/xcollab/clients?clientId=xcollab-svc" -H "$AUTH" | first_id)
RM_ID=$(curl -s "$KC/admin/realms/xcollab/clients?clientId=realm-management" -H "$AUTH" | first_id)
SA_ID=$(curl -s "$KC/admin/realms/xcollab/clients/$SVC_ID/service-account-user" -H "$AUTH" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).id))")
VIEW_USERS_ROLE=$(curl -s "$KC/admin/realms/xcollab/clients/$RM_ID/roles/view-users" -H "$AUTH")
echo -n "svc view-users grant: "
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$KC/admin/realms/xcollab/users/$SA_ID/role-mappings/clients/$RM_ID" \
  -H "$AUTH" -H "Content-Type: application/json" -d "[$VIEW_USERS_ROLE]"

for U in "jabbir:Jabbir:Parlapati" "sara:Sara:Haddad" "omar:Omar:Rashid"; do
  IFS=: read -r uname first last <<< "$U"
  echo -n "user $uname: "
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$KC/admin/realms/xcollab/users" -H "$AUTH" -H "Content-Type: application/json" -d "{
    \"username\": \"$uname\", \"enabled\": true, \"emailVerified\": true,
    \"firstName\": \"$first\", \"lastName\": \"$last\", \"email\": \"$uname@xcollab.local\",
    \"credentials\": [{\"type\": \"password\", \"value\": \"xcollab-dev\", \"temporary\": false}]
  }"
done

echo -n "verify token grant: "
curl -s -X POST "$KC/realms/xcollab/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=xcollab-web&username=jabbir&password=xcollab-dev" \
  | grep -q access_token && echo ok || echo FAILED

echo -n "verify svc client grant: "
curl -s -X POST "$KC/realms/xcollab/protocol/openid-connect/token" \
  -d "grant_type=client_credentials&client_id=xcollab-svc&client_secret=$SVC_SECRET" \
  | grep -q access_token && echo ok || echo FAILED
