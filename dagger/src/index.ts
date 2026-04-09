import { dag, argument, Container, Directory, Secret, func, object } from "@dagger.io/dagger";

const BUN_IMAGE = "oven/bun:1.3.9";
const PLAYWRIGHT_IMAGE = "mcr.microsoft.com/playwright:v1.57.0-noble";
const BUN_CACHE = "/root/.bun/install/cache";
const COVERAGE_DIRECTORY = "coverage";
const COVERAGE_ARTIFACTS_DIRECTORY = "/tmp/coverage-artifacts";
const WORKDIR = "/work";
const SECRET_SCAN_SCRIPT = `
set -euo pipefail
echo "🔍 Scanning for accidentally committed secrets..."
SECRET_PATTERNS='(sk_live_[a-zA-Z0-9]{20,}|sk_test_[a-zA-Z0-9]{20,}|pk_live_[a-zA-Z0-9]{20,}|whsec_[a-zA-Z0-9]{20,})'
FOUND_SECRETS=$(
  grep -RInI -E "$SECRET_PATTERNS" . \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=coverage \
    --exclude-dir=test-results \
    --exclude-dir=playwright-report \
    --exclude='*.lock' \
    --exclude='*.png' \
    --exclude='*.jpg' \
    --exclude='*.jpeg' \
    --exclude='*.gif' \
    --exclude='*.webp' \
    --exclude='*.svg' \
    --exclude='*.ico' \
    --exclude='*.pdf' \
    --exclude='*.zip' \
    --exclude='*.gz' \
    --exclude='*.tar' 2>/dev/null | \
    grep -v -E "(\\.env\\.example|\\.env\\.sample|example\\.|sample\\.|YOUR_|PLACEHOLDER|EXAMPLE|<.*>|docs/SECURITY\\.md)" || true
)

if [ -n "$FOUND_SECRETS" ]; then
  echo "❌ SECURITY ALERT: Potential secrets found in repository!"
  echo "$FOUND_SECRETS" | head -10
  exit 1
fi

echo "✅ No secrets detected in repository"
`;

const SECURITY_AUDIT_SCRIPT = `
set -euo pipefail
echo "🔍 Checking for security vulnerabilities in dependencies..."
bun audit --production --audit-level moderate
echo "✅ Security audit complete"
`;

const ENV_VERIFY_SCRIPT = `
set -euo pipefail
echo "🔍 Verifying environment variable handling..."

if grep -q "NEXT_PUBLIC_CONVEX_URL" .next/static/chunks/*.js 2>/dev/null || \
   grep -q "fleet-goldfish-183" .next/static/chunks/*.js 2>/dev/null; then
  echo "✅ NEXT_PUBLIC_CONVEX_URL properly embedded in client bundle"
else
  echo "⚠️ Warning: NEXT_PUBLIC_CONVEX_URL might not be properly embedded"
fi

if grep -E "sk_(test|live)_[A-Za-z0-9]{40,}" .next/static/chunks/*.js 2>/dev/null; then
  echo "❌ ERROR: Actual Clerk secret key found in client bundle!"
  exit 1
fi

if grep -E "(dev|prod):[a-z-]+\\|[A-Za-z0-9+/=]{20,}" .next/static/chunks/*.js 2>/dev/null; then
  echo "❌ ERROR: Convex deployment key found in client bundle!"
  exit 1
fi

echo "✅ No sensitive secrets exposed in client bundle"
echo "✅ Environment variable verification passed"
`;
const EXPORT_COVERAGE_ARTIFACTS_SCRIPT = `
set -euo pipefail

if [ ! -d "${COVERAGE_DIRECTORY}" ]; then
  echo "❌ Coverage directory was not produced"
  exit 1
fi

if [ ! -f "${COVERAGE_DIRECTORY}/coverage-summary.json" ] || [ ! -f "${COVERAGE_DIRECTORY}/coverage-final.json" ]; then
  echo "❌ Expected coverage artifacts were not produced"
  echo "Contents of ${COVERAGE_DIRECTORY}:"
  find "${COVERAGE_DIRECTORY}" -maxdepth 3 -type f | sort || true
  exit 1
fi

mkdir -p "${COVERAGE_ARTIFACTS_DIRECTORY}"
cp "${COVERAGE_DIRECTORY}/coverage-summary.json" "${COVERAGE_ARTIFACTS_DIRECTORY}/coverage-summary.json"
cp "${COVERAGE_DIRECTORY}/coverage-final.json" "${COVERAGE_ARTIFACTS_DIRECTORY}/coverage-final.json"
`;

@object()
export class Ci {
  private withOptionalEnvVariable(container: Container, key: string, value?: string): Container {
    return value ? container.withEnvVariable(key, value) : container;
  }

  private withOptionalSecretVariable(container: Container, key: string, value?: Secret): Container {
    return value ? container.withSecretVariable(key, value) : container;
  }

  private normalizeQualityCheck(check: string): "lint" | "type-check" {
    if (check === "lint" || check === "type-check") {
      return check;
    }

    throw new Error(`Unsupported quality check: ${check}`);
  }

  private baseContainer(image: string = BUN_IMAGE): Container {
    return dag
      .container()
      .from(image)
      .withEnvVariable("CI", "1")
      .withMountedCache(BUN_CACHE, dag.cacheVolume("chrondle-bun-cache-v1"))
      .withWorkdir(WORKDIR);
  }

  private appContainer(source: Directory): Container {
    return this.baseContainer()
      .withDirectory(WORKDIR, source)
      .withWorkdir(WORKDIR)
      .withExec(["bun", "install", "--frozen-lockfile"])
      .withExec(["bun", "install", "--cwd", "dagger", "--frozen-lockfile"]);
  }

  private qualityContainer(source: Directory, check: "lint" | "type-check"): Container {
    let container = this.appContainer(source)
      .withExec(["sh", "-lc", SECRET_SCAN_SCRIPT])
      .withExec(["sh", "-lc", SECURITY_AUDIT_SCRIPT])
      .withExec(["bun", "run", "verify:convex"])
      .withExec(["bunx", "tsc", "-p", "dagger/tsconfig.json", "--noEmit"]);

    if (check === "lint") {
      container = container.withExec(["bun", "run", "lint"]);
    } else {
      container = container.withExec(["bun", "run", "type-check"]);
    }

    return container;
  }

  private testCoverageArtifactsDirectory(source: Directory): Directory {
    return this.appContainer(source)
      .withExec(["sh", "-lc", SECRET_SCAN_SCRIPT])
      .withExec(["sh", "-lc", SECURITY_AUDIT_SCRIPT])
      .withExec(["bun", "run", "verify:convex"])
      .withExec(["bun", "run", "test:coverage"])
      .withExec(["sh", "-lc", EXPORT_COVERAGE_ARTIFACTS_SCRIPT])
      .directory(COVERAGE_ARTIFACTS_DIRECTORY);
  }

  private validationContainer(source: Directory): Container {
    return this.appContainer(source)
      .withExec(["bun", "run", "validate-puzzles"])
      .withExec(["bun", "run", "test-module-system"]);
  }

  private docsLinkCheckContainer(source: Directory): Container {
    return dag
      .container()
      .from("lycheeverse/lychee:0.22.0")
      .withMountedDirectory(WORKDIR, source)
      .withWorkdir(WORKDIR)
      .withExec([
        "sh",
        "-lc",
        "find . -name '*.md' ! -path './.backlog.d/*' ! -path './docs/archive/reports/*' ! -path './docs/specs/*' -print0 | xargs -0 -r lychee --offline --no-progress --root-dir /work --exclude '^/Users/'",
      ]);
  }

  private verifyEnvConfigContainer(
    source: Directory,
    environment: string,
    {
      nextPublicConvexUrl,
      nextPublicClerkPublishableKey,
      nextPublicStripePublishableKey,
      stripePriceMonthly,
      stripePriceAnnual,
      clerkSecretKey,
      convexDeployKey,
      stripeSecretKey,
      stripeWebhookSecret,
      stripeSyncSecret,
    }: {
      nextPublicConvexUrl: string;
      nextPublicClerkPublishableKey: string;
      nextPublicStripePublishableKey?: string;
      stripePriceMonthly?: string;
      stripePriceAnnual?: string;
      clerkSecretKey?: Secret;
      convexDeployKey?: Secret;
      stripeSecretKey?: Secret;
      stripeWebhookSecret?: Secret;
      stripeSyncSecret?: Secret;
    },
  ): Container {
    let container = this.appContainer(source)
      .withEnvVariable("NEXT_PUBLIC_CONVEX_URL", nextPublicConvexUrl)
      .withEnvVariable("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", nextPublicClerkPublishableKey);

    container = this.withOptionalEnvVariable(
      container,
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      nextPublicStripePublishableKey,
    );
    container = this.withOptionalEnvVariable(container, "STRIPE_PRICE_MONTHLY", stripePriceMonthly);
    container = this.withOptionalEnvVariable(container, "STRIPE_PRICE_ANNUAL", stripePriceAnnual);
    container = this.withOptionalSecretVariable(container, "CLERK_SECRET_KEY", clerkSecretKey);
    container = this.withOptionalSecretVariable(container, "CONVEX_DEPLOY_KEY", convexDeployKey);
    container = this.withOptionalSecretVariable(container, "STRIPE_SECRET_KEY", stripeSecretKey);
    container = this.withOptionalSecretVariable(
      container,
      "STRIPE_WEBHOOK_SECRET",
      stripeWebhookSecret,
    );
    container = this.withOptionalSecretVariable(container, "STRIPE_SYNC_SECRET", stripeSyncSecret);

    return container.withExec(["bun", "run", "verify:env", "--", environment]);
  }

  private verifyStripeConfigContainer(
    source: Directory,
    {
      nextPublicStripePublishableKey,
      stripePriceMonthly,
      stripePriceAnnual,
      stripeSecretKey,
      stripeWebhookSecret,
      requireLive,
    }: {
      nextPublicStripePublishableKey: string;
      stripePriceMonthly: string;
      stripePriceAnnual: string;
      stripeSecretKey: Secret;
      stripeWebhookSecret: Secret;
      requireLive: boolean;
    },
  ): Container {
    const command = requireLive
      ? ["bun", "run", "verify:stripe", "--", "--live"]
      : ["bun", "run", "verify:stripe"];

    return this.appContainer(source)
      .withEnvVariable("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", nextPublicStripePublishableKey)
      .withEnvVariable("STRIPE_PRICE_MONTHLY", stripePriceMonthly)
      .withEnvVariable("STRIPE_PRICE_ANNUAL", stripePriceAnnual)
      .withSecretVariable("STRIPE_SECRET_KEY", stripeSecretKey)
      .withSecretVariable("STRIPE_WEBHOOK_SECRET", stripeWebhookSecret)
      .withExec(command);
  }

  private buildArtifactsDirectory(
    source: Directory,
    nextPublicConvexUrl: string,
    nextPublicClerkPublishableKey: string,
  ): Directory {
    return this.appContainer(source)
      .withExec(["bun", "run", "verify:convex"])
      .withEnvVariable("DAGGER_ARTIFACT_BUILD", "1")
      .withEnvVariable("NEXT_PUBLIC_CONVEX_URL", nextPublicConvexUrl)
      .withEnvVariable("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", nextPublicClerkPublishableKey)
      .withExec(["bun", "run", "build"])
      .withExec(["sh", "-lc", ENV_VERIFY_SCRIPT])
      .withExec(["bun", "run", "size"])
      .withExec(["sh", "-lc", "find .next -name '*:*' -delete"])
      .directory(`${WORKDIR}/.next`);
  }

  private playwrightContainer(
    source: Directory,
    nextPublicConvexUrl: string,
    nextPublicClerkPublishableKey: string,
    clerkSecretKey?: Secret,
  ): Container {
    let container = this.baseContainer(PLAYWRIGHT_IMAGE)
      .withExec(["npm", "install", "--global", "bun@1.3.9"])
      .withFile(`${WORKDIR}/package.json`, source.file("package.json"))
      .withFile(`${WORKDIR}/bun.lock`, source.file("bun.lock"))
      .withExec(["bun", "install", "--frozen-lockfile"])
      .withDirectory(WORKDIR, source)
      .withEnvVariable("NEXT_PUBLIC_CONVEX_URL", nextPublicConvexUrl)
      .withEnvVariable("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", nextPublicClerkPublishableKey);

    if (clerkSecretKey) {
      container = container.withSecretVariable("CLERK_SECRET_KEY", clerkSecretKey);
    }

    return container;
  }

  @func()
  async quality(
    check: string,
    // Keep ignore arrays inline. Dagger's TS introspector does not resolve shared
    // top-level constants inside decorator metadata during module initialization.
    @argument({
      defaultPath: "/",
      ignore: [
        ".git",
        ".git/**",
        "node_modules",
        "node_modules/**",
        ".next",
        ".next/**",
        ".nyc_output",
        ".nyc_output/**",
        "coverage",
        "coverage/**",
        "playwright-report",
        "playwright-report/**",
        "test-results",
        "test-results/**",
        ".dagger-e2e",
        ".dagger-e2e/**",
        ".env",
        ".env.local",
        ".env.production",
      ],
    })
    source: Directory,
  ): Promise<string> {
    const normalizedCheck = this.normalizeQualityCheck(check);
    await this.qualityContainer(source, normalizedCheck).sync();
    return `${normalizedCheck} quality check passed`;
  }

  @func()
  testCoverageArtifacts(
    @argument({
      defaultPath: "/",
      ignore: [
        ".git",
        ".git/**",
        "node_modules",
        "node_modules/**",
        ".next",
        ".next/**",
        ".nyc_output",
        ".nyc_output/**",
        "coverage",
        "coverage/**",
        "playwright-report",
        "playwright-report/**",
        "test-results",
        "test-results/**",
        ".dagger-e2e",
        ".dagger-e2e/**",
        ".env",
        ".env.local",
        ".env.production",
      ],
    })
    source: Directory,
  ): Directory {
    return this.testCoverageArtifactsDirectory(source);
  }

  @func()
  async validation(
    @argument({
      defaultPath: "/",
      ignore: [
        ".git",
        ".git/**",
        "node_modules",
        "node_modules/**",
        ".next",
        ".next/**",
        ".nyc_output",
        ".nyc_output/**",
        "coverage",
        "coverage/**",
        "playwright-report",
        "playwright-report/**",
        "test-results",
        "test-results/**",
        ".dagger-e2e",
        ".dagger-e2e/**",
        ".env",
        ".env.local",
        ".env.production",
      ],
    })
    source: Directory,
  ): Promise<string> {
    await this.validationContainer(source).sync();

    return "validation checks passed";
  }

  @func()
  async docsLinkCheck(
    @argument({
      defaultPath: "/",
      ignore: [
        ".git",
        ".git/**",
        "node_modules",
        "node_modules/**",
        ".next",
        ".next/**",
        ".nyc_output",
        ".nyc_output/**",
        "coverage",
        "coverage/**",
        "playwright-report",
        "playwright-report/**",
        "test-results",
        "test-results/**",
        ".dagger-e2e",
        ".dagger-e2e/**",
        ".env",
        ".env.local",
        ".env.production",
      ],
    })
    source: Directory,
  ): Promise<string> {
    await this.docsLinkCheckContainer(source).sync();

    return "docs link check passed";
  }

  @func()
  buildArtifacts(
    nextPublicConvexUrl: string,
    nextPublicClerkPublishableKey: string,
    @argument({
      defaultPath: "/",
      ignore: [
        ".git",
        ".git/**",
        "node_modules",
        "node_modules/**",
        ".next",
        ".next/**",
        ".nyc_output",
        ".nyc_output/**",
        "coverage",
        "coverage/**",
        "playwright-report",
        "playwright-report/**",
        "test-results",
        "test-results/**",
        ".dagger-e2e",
        ".dagger-e2e/**",
        ".env",
        ".env.local",
        ".env.production",
      ],
    })
    source: Directory,
  ): Directory {
    return this.buildArtifactsDirectory(source, nextPublicConvexUrl, nextPublicClerkPublishableKey);
  }

  @func()
  e2eArtifacts(
    nextPublicConvexUrl: string,
    nextPublicClerkPublishableKey: string,
    @argument({
      defaultPath: "/",
      ignore: [
        ".git",
        ".git/**",
        "node_modules",
        "node_modules/**",
        ".nyc_output",
        ".nyc_output/**",
        "coverage",
        "coverage/**",
        "playwright-report",
        "playwright-report/**",
        "test-results",
        "test-results/**",
        ".dagger-e2e",
        ".dagger-e2e/**",
        ".env",
        ".env.local",
        ".env.production",
      ],
    })
    source: Directory,
    clerkSecretKey?: Secret,
  ): Directory {
    return this.playwrightContainer(
      source,
      nextPublicConvexUrl,
      nextPublicClerkPublishableKey,
      clerkSecretKey,
    )
      .withExec([
        "sh",
        "-lc",
        `
set +e
bunx playwright install --with-deps chromium
bun run test:e2e
status=$?
mkdir -p /tmp/e2e-out
if [ -d playwright-report ]; then
  cp -R playwright-report /tmp/e2e-out/playwright-report
else
  mkdir -p /tmp/e2e-out/playwright-report
fi
echo "$status" > /tmp/e2e-out/exit-code
exit 0
`,
      ])
      .directory("/tmp/e2e-out");
  }

  @func()
  async verifyEnvConfig(
    environment: string,
    nextPublicConvexUrl: string,
    nextPublicClerkPublishableKey: string,
    @argument({
      defaultPath: "/",
      ignore: [
        ".git",
        ".git/**",
        "node_modules",
        "node_modules/**",
        ".next",
        ".next/**",
        ".nyc_output",
        ".nyc_output/**",
        "coverage",
        "coverage/**",
        "playwright-report",
        "playwright-report/**",
        "test-results",
        "test-results/**",
        ".dagger-e2e",
        ".dagger-e2e/**",
        ".env",
        ".env.local",
        ".env.production",
      ],
    })
    source: Directory,
    clerkSecretKey?: Secret,
    convexDeployKey?: Secret,
    stripeSecretKey?: Secret,
    stripeWebhookSecret?: Secret,
    stripeSyncSecret?: Secret,
    nextPublicStripePublishableKey?: string,
    stripePriceMonthly?: string,
    stripePriceAnnual?: string,
  ): Promise<string> {
    await this.verifyEnvConfigContainer(source, environment, {
      nextPublicConvexUrl,
      nextPublicClerkPublishableKey,
      nextPublicStripePublishableKey,
      stripePriceMonthly,
      stripePriceAnnual,
      clerkSecretKey,
      convexDeployKey,
      stripeSecretKey,
      stripeWebhookSecret,
      stripeSyncSecret,
    }).sync();

    return `${environment} environment config validated`;
  }

  @func()
  async verifyStripeConfig(
    nextPublicStripePublishableKey: string,
    stripePriceMonthly: string,
    stripePriceAnnual: string,
    requireLive: boolean,
    @argument({
      defaultPath: "/",
      ignore: [
        ".git",
        ".git/**",
        "node_modules",
        "node_modules/**",
        ".next",
        ".next/**",
        ".nyc_output",
        ".nyc_output/**",
        "coverage",
        "coverage/**",
        "playwright-report",
        "playwright-report/**",
        "test-results",
        "test-results/**",
        ".dagger-e2e",
        ".dagger-e2e/**",
        ".env",
        ".env.local",
        ".env.production",
      ],
    })
    source: Directory,
    stripeSecretKey: Secret,
    stripeWebhookSecret: Secret,
  ): Promise<string> {
    await this.verifyStripeConfigContainer(source, {
      nextPublicStripePublishableKey,
      stripePriceMonthly,
      stripePriceAnnual,
      stripeSecretKey,
      stripeWebhookSecret,
      requireLive,
    }).sync();

    return "stripe config validated";
  }

  @func()
  async check(
    nextPublicConvexUrl: string,
    nextPublicClerkPublishableKey: string,
    @argument({
      defaultPath: "/",
      ignore: [
        ".git",
        ".git/**",
        "node_modules",
        "node_modules/**",
        ".next",
        ".next/**",
        ".nyc_output",
        ".nyc_output/**",
        "coverage",
        "coverage/**",
        "playwright-report",
        "playwright-report/**",
        "test-results",
        "test-results/**",
        ".dagger-e2e",
        ".dagger-e2e/**",
        ".env",
        ".env.local",
        ".env.production",
      ],
    })
    source: Directory,
  ): Promise<string> {
    await this.qualityContainer(source, "type-check").sync();
    await this.qualityContainer(source, "lint").sync();
    await this.validationContainer(source).sync();
    await this.docsLinkCheckContainer(source).sync();
    await this.buildArtifactsDirectory(source, nextPublicConvexUrl, nextPublicClerkPublishableKey)
      .file("BUILD_ID")
      .sync();
    await this.testCoverageArtifactsDirectory(source).file("coverage-summary.json").sync();

    return "All Dagger CI checks completed.";
  }
}
