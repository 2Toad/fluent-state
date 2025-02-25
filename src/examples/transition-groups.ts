import { FluentState } from "../fluent-state";
import { AutoTransitionConfig } from "../types";

// Define type interfaces instead of using 'any'
interface AuthContext {
  credentials: unknown | null;
  isAuthenticated: boolean;
  authError: unknown | null;
}

interface UploadContext {
  files?: { length: number };
  progress: number;
}

// Create a new state machine
const fs = new FluentState({
  initialState: "idle",
});

// Example 1: Basic group creation
// Create a group for user authentication flow with fluent API
const authFlow = fs.createGroup("authentication").withConfig({
  priority: 2,
  retryConfig: {
    maxAttempts: 3,
    delay: 1000,
  },
});

// Add transitions to the group with fluent syntax
authFlow.from("loggedOut").to<AuthContext>("authenticating", {
  condition: (_, context) => context.credentials !== null,
  targetState: "authenticating",
});

authFlow
  .from("authenticating")
  .to<AuthContext>("loggedIn", {
    condition: (_, context) => context.isAuthenticated,
    targetState: "loggedIn",
  })
  .or<AuthContext>("error", {
    condition: (_, context) => context.authError !== null,
    targetState: "error",
  });

// Example 2: Group with namespace
const uploadFlow = fs.createGroup("media:upload").withConfig({
  debounce: 300,
});

uploadFlow.from("idle").to<UploadContext>("uploading", {
  condition: (_, context) => context.files?.length > 0,
  targetState: "uploading",
});

uploadFlow.from("uploading").to<UploadContext>("processing", {
  condition: (_, context) => context.progress === 100,
  targetState: "processing",
});

// Example 3: Disabling and enabling groups
console.log(`Authentication flow enabled: ${authFlow.isEnabled()}`); // true
authFlow.disable();
console.log(`Authentication flow enabled: ${authFlow.isEnabled()}`); // false
authFlow.enable();
console.log(`Authentication flow enabled: ${authFlow.isEnabled()}`); // true

// Example 4: Temporary disabling
uploadFlow.disableTemporarily(5000, () => {
  console.log("Upload flow re-enabled after 5 seconds");
});

// Example 5: Getting groups by name
const authGroup = fs.group("authentication");
console.log(`Retrieved auth group: ${authGroup?.getFullName()}`);

const uploadGroup = fs.group("media:upload");
console.log(`Retrieved upload group: ${uploadGroup?.getFullName()}`);

// Example 6: Listing all groups
console.log("All groups:");
fs.getAllGroups().forEach((group) => {
  console.log(`- ${group.getFullName()} (${group.isEnabled() ? "enabled" : "disabled"})`);
});

// Example 7: Serialization and deserialization
const serialized = authFlow.serialize();
console.log("Serialized auth flow:", JSON.stringify(serialized, null, 2));

// Remove the group
fs.removeGroup("authentication");
console.log(`Auth group exists: ${fs.group("authentication") !== null}`); // false

// Recreate from serialized data with condition functions
const conditionMap: Record<string, Record<string, AutoTransitionConfig["condition"]>> = {
  loggedOut: {
    authenticating: (_, context: AuthContext) => context.credentials !== null,
  },
  authenticating: {
    loggedIn: (_, context: AuthContext) => context.isAuthenticated,
    error: (_, context: AuthContext) => context.authError !== null,
  },
};

fs.createGroupFromConfig(serialized, conditionMap);
console.log(`Auth group restored: ${fs.group("authentication") !== null}`); // true

// Example 8: Export all groups
const allGroups = fs.exportGroups();
console.log(`Exported ${allGroups.length} groups`);

// Import with options
fs.importGroups(allGroups, {}, { skipExisting: true });
