const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const serverDir = path.join(__dirname, "../server");

try {
  console.log("Generating dev certificates for HTTPS (required by Office Add-ins)...");
  execSync("npx office-addin-dev-certs install --days 365", { stdio: "inherit" });

  const certsDir = path.join(require("os").homedir(), ".office-addin-dev-certs");
  const certSrc = path.join(certsDir, "localhost.crt");
  const keySrc = path.join(certsDir, "localhost.key");

  if (fs.existsSync(certSrc)) {
    fs.copyFileSync(certSrc, path.join(serverDir, "cert.pem"));
    fs.copyFileSync(keySrc, path.join(serverDir, "key.pem"));
    console.log("Certificates copied to server/");
  }
  console.log("Done. Run `npm run dev` to start.");
} catch (err) {
  console.error("Certificate setup failed:", err.message);
  console.log("You can manually place cert.pem and key.pem in server/ for HTTPS.");
}
