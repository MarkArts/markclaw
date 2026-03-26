---
name: pulumi-infra
version: 2.0.0
description: Working with Quatt's Pulumi and Terraform IaC repos. Use when editing infra repos, creating new stacks, reviewing IaC PRs, or understanding AWS account/networking layout.
---

# Pulumi Infrastructure Skill

## When to Use

Use this skill when:
- Working on any Pulumi or Terraform repo in the Quattio org
- Creating a new infrastructure stack
- Reviewing IaC PRs
- Understanding which AWS account/profile to use
- Allocating IP ranges or adding VPC resources
- Managing developer instances or Tailscale ACLs

---

## Prerequisites — AWS SSO Setup

Pulumi needs AWS credentials to preview and apply changes. Quatt uses AWS IAM Identity Center (SSO) for authentication.

**First-time setup:** follow the [AWS SSO login guide](https://quatt.slite.com/app/docs/hpOwX_fRtN8R1R) to configure your AWS CLI with SSO profiles.

**Per-session authentication:**
```bash
aws sso login
```
If running as an agent (no browser access), use `aws sso login --no-browser` to get a URL the user can open to authenticate on your behalf.

**Which profile to use:** look up the correct AWS account, profile name, and permissions for the stack you're working on in the [aws-pulumi-state](https://github.com/Quattio/aws-pulumi-state) repo. Set the profile before running pulumi commands:
```bash
export AWS_PROFILE=<profile-from-aws-pulumi-state>
```

For the full Pulumi setup guide (including Pulumi state backend access): https://quatt.slite.com/app/docs/9yaX4_ICJ2Ek--

---

## Requirements

Before making any change, ALWAYS look up the types and properties of the Pulumi resource you are editing. Never add a property that doesn't exist on a resource. Read the Pulumi docs for the resource before making the edit.

## Verification

Allowed commands:
- `pulumi stack select develop` to select the develop stack
- `pulumi preview` to preview code changes against AWS
- `pulumi up` to apply changes **ONLY on the develop stack**

Before running these commands:
1. Verify `AWS_PROFILE` is set to the correct environment
2. Run `pulumi preview` to review changes first
3. Confirm the stack is "develop" with `pulumi stack`

## NEVER Do This

- NEVER run typechecking directly — always use `pulumi preview` to verify code correctness
- NEVER run `pulumi up` on any stack other than develop (never on staging or production)
- NEVER run pulumi commands on staging or production stacks
- NEVER make writes or edits with the AWS CLI — only use Pulumi to change deployed infra
- NEVER try to compile TypeScript directly — just use pulumi commands

---

## AWS Accounts & Profiles

For AWS account IDs and profiles, see the [aws-pulumi-state](https://github.com/Quattio/aws-pulumi-state) repo.

---

## Networking / IPAM

IP ranges are allocated through IPAM in the `awsx` VPC resource. See the [IPAM documentation](https://quatt.slite.com/api/s/AR3I5yCX7XQ-pI) for details.

---

## Pulumi Style Guide

### Casing

- Variables, functions, parameters, members: `camelCase`
- Types, classes, interfaces: `PascalCase`
- Modules: `kebab-case.ts`

### No One-Off Variables

Don't create variables just to pass them once. Inline the value.

```typescript
// BAD
const myvar = getvar("bla");
const res = otherfunction(bla, { arg: myvar });

// GOOD
const res = otherfunction(bla, { arg: getvar("bla") });
```

### Resource Naming — Use a Common Prefix

Each Pulumi resource name must be unique. All resources in a function use the same `prefix` so the caller controls naming. Functions follow the same argument pattern as Pulumi resources: `(prefix, args, opts)`.

- Always tag resources: `Provider: Pulumi`, `Project`, `Service`, `stack`

```typescript
function myfunction(prefix: string) {
  const vpc1 = new aws.ec2.Vpc(`${prefix}_vpc`);
  const subnet = createVpcSubnet(prefix, { vpc: vpc1 });
  return { vpc1, subnet };
}
```

### Never Use Output in Resource Names

Dynamic resource names break Pulumi internals and lose idempotency. Use static/index-based names.

```typescript
// BAD
vpcs.map(x => {
  const vpc = new aws.ec2.Vpc(prefix);
  const subnet = new aws.ec2.Subnet(`${vpc.id}-subnet`);
});

// GOOD
vpcs.map((x, index) => {
  const vpc = new aws.ec2.Vpc(prefix);
  const subnet = new aws.ec2.Subnet(`vpc-${index}-subnet`);
});
```

### Always Pass CustomResourceOptions (opts)

Every function that creates resources must accept `pulumi.CustomResourceOptions` as the **last parameter** and pass it to all resources. This supports multi-provider setups (multi-region or AWS+K8s) and dependency management via `dependsOn`.

```typescript
function myfunction(prefix: string, opts: pulumi.CustomResourceOptions) {
  const vpc = new aws.ec2.Vpc(prefix, {}, opts);
  const subnet = new aws.ec2.Subnet(`${prefix}-subnet`, {}, opts);
  return { vpc, subnet };
}
```

### Return All Created Resources (Not Specific Values)

Return the full resource objects so dependents can correctly depend on them and choose how to use the outputs.

```typescript
// GOOD
function myfunction() {
  const vpc1 = new aws.ec2.Vpc();
  const vpc2 = new aws.ec2.Vpc();
  return { vpc1, vpc2 };
}

// BAD — loses dependency tracking
function myfunction() {
  const vpc1 = new aws.ec2.Vpc();
  const vpc2 = new aws.ec2.Vpc();
  return { vpc1Id: vpc1.id, vpc2Name: vpc2.name };
}
```

### Never Accept Output<T> — Accept Input<T>

Always use `pulumi.Input<T>` for parameters that might receive resource outputs. `Input<T>` is compatible with both `Output<T>` and plain values like `string`.

```typescript
function myfunction(prefix: string, args: { vpcId: pulumi.Input<string> }, opts: pulumi.CustomResourceOptions) {
  return new aws.ec2.Something(`${prefix}-thing`, { vpcId: args.vpcId }, opts);
}
```

### Don't Import Types from Other Modules

Type what your function expects explicitly instead of importing types from other modules. This avoids strong coupling and unintended side effects (e.g. a type marking a property as required when your function doesn't use it).

See: [The bigger the interface, the weaker the abstraction](https://www.youtube.com/watch?v=PAAkCSZUG1c&t=5m17s)

```typescript
// BAD — couples to the full VPCConfig type
myFunction = (vpcConfig: vpcModule.VPCConfig) => { ... }

// GOOD — only declares what you use
myFunction = (vpcConfig: { vpcId: string }) => { ... }
```

### Set allowedAccountIds in Pulumi Config

Prevent executing a dev stack on prod by setting `config.allowedAccountIds` in your Pulumi config.

### Set Common Tags in Code, Not Config

Changing tags set in Pulumi config will not trigger redeploy of resources. Set tags explicitly in code so they are always applied on deploy.

---

## Template Function

All Pulumi resource-creating functions should follow this pattern:

```typescript
export const myFunction = (
  prefix: string,
  args: {
    someParam: pulumi.Input<string>,
    someOtherParam: string,
  },
  opts: pulumi.CustomResourceOptions
) => {
  opts = { ...opts };

  const vpc = new aws.ec2.Vpc(`${prefix}_vpc`, {}, opts);

  // Always return all created resources flat
  return {
    vpc,
  };
};
```

### Complex Example

```typescript
import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export type SetupRoute53ZoneArgs = {
  zoneUserKeyId: pulumi.Input<string>,
  zoneUserKey: pulumi.Input<string>,
  namespace: pulumi.Input<string>,
  domain: pulumi.Input<string>,
};

export const SetupDNSController = (
  prefix: string,
  args: SetupRoute53ZoneArgs,
  opts: pulumi.ComponentResourceOptions
) => {
  const dnsSecret = new k8s.core.v1.Secret(
    `${prefix}-secret`,
    {
      metadata: {
        name: `${prefix}-secret`,
        namespace: args.namespace,
      },
      stringData: {
        AWS_ACCESS_KEY_ID: args.zoneUserKeyId,
        AWS_SECRET_ACCESS_KEY: args.zoneUserKey,
      },
    },
    opts
  );

  const dnsController = new k8s.helm.v3.Chart(
    `${prefix}-dns-controller`,
    {
      fetchOpts: {
        repo: "https://kubernetes-sigs.github.io/external-dns/",
      },
      chart: "external-dns",
      namespace: args.namespace,
      values: {
        provider: "aws",
        sources: ["ingress", "service"],
        logLevel: "debug",
        domainFilters: [args.domain],
        env: [
          {
            name: "AWS_ACCESS_KEY_ID",
            valueFrom: {
              secretKeyRef: {
                name: dnsSecret.metadata.name,
                key: "AWS_ACCESS_KEY_ID",
              },
            },
          },
          {
            name: "AWS_SECRET_ACCESS_KEY",
            valueFrom: {
              secretKeyRef: {
                name: dnsSecret.metadata.name,
                key: "AWS_SECRET_ACCESS_KEY",
              },
            },
          },
        ],
      },
    },
    opts
  );

  return {
    dnsSecret,
    dnsController,
  };
};
```

---

## Key References

| Resource | Link |
|---|---|
| Pulumi setup guide | https://quatt.slite.com/app/docs/9yaX4_ICJ2Ek-- |
| Pulumi style guide | https://quatt.slite.com/app/docs/nbMNTwZXgzGtVf |
| IaC Projects Overview | https://quatt.slite.com/api/s/AR3I5yCX7XQ-pI |
| pulumi-template repo | https://github.com/Quattio/pulumi-template |
| SOPS | https://github.com/getsops/sops |
| Tailscale architecture | https://quatt.slite.com/app/docs/3yfj20n1t-LZOd |
| Domain naming | https://quatt.slite.com/app/docs/w1IgvE736c-SOr |
| 12-Factor Config | https://12factor.net/config |
| The bigger the interface, the weaker the abstraction | https://www.youtube.com/watch?v=PAAkCSZUG1c&t=5m17s |
