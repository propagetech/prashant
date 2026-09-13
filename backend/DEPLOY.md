# Deploy Prashant backend (AWS SAM)

Stack name: `prashant-backend`. Region: `ap-south-1`. Account used by ProPage / Motorover / Invoices: `300601068858`.

## First time

```bash
openssl rand -hex 16 > backend/.admin-token.txt
cd backend
sam build
sam deploy --stack-name prashant-backend --region ap-south-1 \
  --capabilities CAPABILITY_IAM --resolve-s3 --no-confirm-changeset --no-fail-on-empty-changeset \
  --parameter-overrides \
    AllowedOrigin=https://prashant.propage.in \
    AdminToken=$(cat .admin-token.txt) \
    EmailsEnabled=false
```

Omit `RecaptchaSecret=` if empty (the CLI splits on spaces and empty flags misparse). Add `SenderEmail` / `OwnerEmail` and `EmailsEnabled=true` after SES identities are verified.

Copy the `ApiBaseUrl` output into `js/config.js` as `API_BASE`. Pin CORS to `https://prashant.propage.in`.

## Smoke

```bash
API=https://REPLACE.execute-api.ap-south-1.amazonaws.com
curl -s "$API/listing-status"
curl -s "$API/properties"
curl -s -X POST "$API/submit" -H 'content-type: application/json' \
  -d '{"formType":"enquiry","name":"Test","mobile":"9999999999","email":"a@b.co","consent":true,"website_hp":""}'
curl -s "$API/submissions" -H "x-admin-token: $(cat .admin-token.txt)"
# honeypot must not store
curl -s -X POST "$API/submit" -H 'content-type: application/json' \
  -d '{"formType":"enquiry","name":"Bot","mobile":"1","email":"a@b.co","consent":true,"website_hp":"http://spam"}'
```

Do not commit `.admin-token.txt` or `samconfig.toml`.
