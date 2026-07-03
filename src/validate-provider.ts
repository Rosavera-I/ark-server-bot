import { loadConfig } from "./config/env.js";
import { createProvider } from "./providers/index.js";

const validationEnv = {
  ...process.env,
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || "provider-validation",
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || "provider-validation"
};

const config = loadConfig({
  ...validationEnv
});
const provider = createProvider(config);

const message = await provider.validateConnection();
console.log(`Provider ${provider.name} validated: ${message}`);
