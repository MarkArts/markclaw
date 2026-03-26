---
name: aws-query
version: 0.6.0
description: Query and access AWS resources (read-only) across all Quatt accounts via CLI or MCP. Use when helping users access S3 data, CloudWatch logs, IoT Core devices, or other AWS services.
---

# AWS Query via Atlas

## When to Use

Use this skill when you need to:

- Access S3 CIC telemetry data (prefer `atlas data:s3:query-cic` for structured queries)
- View CloudWatch logs for debugging services
- Inspect IoT Core things and shadows for device troubleshooting
- List or inspect Lambda functions, ECS services, SQS queues
- Investigate any AWS resource across Quatt's accounts

## Authentication

AWS access uses SSO via AWS IAM Identity Center (formerly AWS SSO).

**Login:**
```bash
aws sso login
```
If running as an agent (no browser access), use `aws sso login --no-browser` to get a URL the user can open to authenticate on your behalf.

For full setup instructions see the [AWS SSO login guide](https://quatt.slite.com/app/docs/hpOwX_fRtN8R1R).

## Finding the Right Profile

**ALWAYS check the user's local config first** to see which profiles are available:
```bash
grep '\[profile' ~/.aws/config
```

Pick the profile that matches the account and environment you need to access.

For account IDs, profile mappings, and permissions, see the [aws-pulumi-state](https://github.com/Quattio/aws-pulumi-state) repo.

AWS permission sets and user/group assignments are managed in the [aws-iam-identity-center](https://github.com/Quattio/aws-iam-identity-center) repo. If the user does not have the required profile or permission set, offer to create a PR on that repo to request the additional access.

## Common Read-Only Commands

### S3 (CIC Telemetry)

Prefer the Atlas CLI for structured CIC queries:
```bash
bun run atlas data:s3:query-cic --cic-id=CIC-xxx --cloud=production --start-date=2026-02-01 --end-date=2026-02-01 --summary
```

Raw S3 access (use the appropriate profile from `~/.aws/config`):
```bash
aws s3 ls s3://<bucket>/dt/ --profile <profile> --region eu-west-1
aws s3 cp s3://<bucket>/dt/CIC-xxx/2026/02/01/file.json.gz ./local.json.gz --profile <profile> --region eu-west-1
```

### CloudWatch Logs
```bash
# List log groups
aws logs describe-log-groups --profile <profile> --region eu-west-1

# Search logs
aws logs filter-log-events \
  --log-group-name /ecs/<service-name> \
  --start-time $(date -d '1 hour ago' +%s000) \
  --filter-pattern "ERROR" \
  --profile <profile> \
  --region eu-west-1
```

### IoT Core
```bash
# List things
aws iot list-things --profile <profile> --region eu-west-1

# Describe a specific CIC
aws iot describe-thing --thing-name CIC-xxx --profile <profile> --region eu-west-1

# Get device shadow
aws iot-data get-thing-shadow --thing-name CIC-xxx --profile <profile> --region eu-west-1 /dev/stdout
```

### Lambda
```bash
aws lambda list-functions --profile <profile> --region eu-west-1
aws lambda get-function --function-name <function-name> --profile <profile> --region eu-west-1
```

### ECS
```bash
aws ecs list-clusters --profile <profile> --region eu-west-1
aws ecs list-services --cluster <cluster> --profile <profile> --region eu-west-1
aws ecs describe-services --cluster <cluster> --services <service> --profile <profile> --region eu-west-1
```

### SQS
```bash
aws sqs list-queues --profile <profile> --region eu-west-1
aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names All --profile <profile> --region eu-west-1
```

## Safety Rules

- **NEVER use write/mutate operations** (create, delete, update, put, invoke, start, stop, terminate, modify)
- **Always include `--profile` and `--region`** to target the correct account
- **Use `--output json`** for machine-readable output
- **Stick to read-only commands**: list, describe, get, show, filter-log-events

## AWS MCP Server

The official AWS MCP server (`@awslabs/mcp-server-aws`) is configured in Atlas with `READ_OPERATIONS_ONLY=true`. Its `call_aws` tool executes AWS CLI commands — always pass `--profile` and `--region` flags.

