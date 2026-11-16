// Validation only: never import a database client or external transport.
try {
  const { initializeEnvironment } = require("../src/config/environment");
  const config = initializeEnvironment();
  console.log("Backend configuration accepted for " + config.appEnv + ". No connections opened.");
} catch {
  console.error("Backend configuration rejected. Check APP_ENV and its isolated environment file; details withheld.");
  process.exitCode = 1;
}
