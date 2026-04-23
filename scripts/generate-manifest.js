#!/usr/bin/env node
/**
 * Generates manifest.xml from manifest.template.xml.
 * Usage:
 *   node scripts/generate-manifest.js \
 *     --host https://localhost:3000 \
 *     --account https://myorg-myaccount.snowflakecomputing.com
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : null;
}

const host = getArg("host") || process.env.ADDIN_HOST_URL || "https://localhost:3000";
const account = getArg("account") || process.env.SNOWFLAKE_ACCOUNT_URL || "";

if (!account) {
  console.error("Error: --account is required (e.g. https://myorg-myaccount.snowflakecomputing.com)");
  process.exit(1);
}

const template = fs.readFileSync(
  path.join(__dirname, "../manifest.template.xml"),
  "utf-8"
);

const manifest = template
  .replace(/ADDIN_HOST_URL/g, host.replace(/\/$/, ""))
  .replace(/SNOWFLAKE_ACCOUNT_URL/g, account.replace(/\/$/, ""));

fs.writeFileSync(path.join(__dirname, "../manifest.xml"), manifest);
console.log(`✓ manifest.xml generated`);
console.log(`  Host:    ${host}`);
console.log(`  Account: ${account}`);
