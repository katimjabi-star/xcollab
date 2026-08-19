#!/bin/zsh
# Re-bootstrap the xcollab realm (dev-only credentials) incl. the branded login theme.
set -e
KC=http://localhost:8081
TOKEN=$(curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=admin-cli&username=admin&password=admin_dev_only" \
  | /Users/PJAB1870/.nvm/versions/node/v24.18.0/bin/node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).access_token))")
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
