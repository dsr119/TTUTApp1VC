# Architecture and compliance plan

## Why this stack

Every piece runs on AWS services covered by the AWS BAA, so no third party holds client information.

| Concern | Local / review | Production on AWS |
| --- | --- | --- |
| App | `next dev` | Docker image on **ECS Fargate** (or App Runner) behind an **Application Load Balancer** with TLS from **ACM** |
| Database | Postgres in Docker | **Amazon RDS for PostgreSQL**, encrypted with KMS, Multi-AZ, automated backups, private subnets only |
| Sign-in | Email + password, sessions in the database | **Amazon Cognito** user pool with MFA; the app keeps its own short sessions after Cognito sign-in |
| Secrets | `.env` | **AWS Secrets Manager** |
| Logs | console | **CloudWatch Logs** (no message bodies or notes logged) + **CloudTrail** |
| Real-time chat | page refresh every few seconds | API Gateway WebSockets or AppSync, if polling becomes a problem |
| Email/SMS notifications (later) | none | Amazon SES / SNS (both BAA-eligible) |

Only BAA-eligible services may be added. Before adding any SaaS, confirm it signs a BAA.

## Data model

See `prisma/schema.prisma`. Main tables:

- **User** (role STAFF/ADMIN/OWNER, base rate, manager for the future org chart)
- **TimeEntry** (clock or manual, service, kid, note, status) and **TimeChangeRequest** (staff-proposed edits)
- **Service**, **StaffServiceRate** (pay rules), **Client** (kids: first name + last initial only)
- **Conversation**, **ConversationMember**, **Message**, **Announcement**, **TimeOffRequest**
- **AuditLog** (who did what and when)

Pay for a shift = staff rate for that service, else the service's rate, else the staff member's base rate.

## Safeguards already in the code

- **Minimum necessary:** kids are stored and shown as first name + last initial. Kid names are left out of payroll exports unless the admin opts in.
- **Access control:** every page and server action checks the signed-in user's role on the server. Staff can only see and change their own time; they request changes rather than editing.
- **Audit trail:** sign-ins, failed sign-ins, clock events, manual entries, approvals, admin edits (before/after times), rate changes, people changes and exports are written to `AuditLog`. Shift history is visible on the admin edit screen.
- **Sessions:** random 256-bit tokens, stored only as SHA-256 hashes, httpOnly + Secure cookies, 12-hour expiry, revoked when a person is deactivated.
- **Passwords:** bcrypt (cost 12); comparison runs even for unknown emails.
- **Transport and caching:** HSTS, `no-store` on pages, frame blocking, no referrer, search engines blocked.
- **CSV safety:** exported cells are escaped to stop spreadsheet formula injection.
- **No PHI in seeds:** demo data is fictional, and seeding refuses to run in production.

## Still to do before go-live

- Switch sign-in to Cognito with MFA required; add idle timeout on shared devices.
- Infrastructure as code (CDK or Terraform) for the VPC, RDS, ECS, ALB, WAF, backups.
- Admin screen to view the audit log; retention policy (HIPAA: 6 years).
- Risk assessment, policies, and staff training (administrative safeguards are outside the code).
- FERPA: confirm with the clinic which school records, if any, will be stored, and who may see them.
- Migrate client data from IntakeQ once this app replaces it.
