# Deploy the properties backend (AWS SAM)

Stack name: `properties-backend`. Region: `ap-south-1`. Account used by ProPage / Motorover / Invoices: `300601068858`.
The GitHub repository stays [propagetech/prashant](https://github.com/propagetech/prashant).

If this account already has a live stack from an earlier name, keep deploying that stack until you are ready to cut over tables and the API URL.

## First time

```bash
openssl rand -hex 16 > backend/.admin-token.txt
cd backend
sam build
sam deploy --stack-name properties-backend --region ap-south-1 \
  --capabilities CAPABILITY_IAM --resolve-s3 --no-confirm-changeset --no-fail-on-empty-changeset \
  --parameter-overrides \
    AllowedOrigin=https://p.propage.in \
    AdminToken=$(cat .admin-token.txt) \
    EmailsEnabled=false
```

Omit `RecaptchaSecret=` if empty (the CLI splits on spaces and empty flags misparse). Add `SenderEmail` / `OwnerEmail` and `EmailsEnabled=true` after SES identities are verified.

Copy the `ApiBaseUrl` output into `js/config.js` as `API_BASE`. Pin CORS to `https://p.propage.in`.

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
