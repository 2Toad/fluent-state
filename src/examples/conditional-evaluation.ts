import { FluentState } from "../fluent-state";

// Example: Conditional Auto-transition Evaluation
// This example demonstrates the various ways to control when auto-transitions are evaluated

interface UserFormState {
  // User input form fields
  values: {
    email: string;
    password: string;
    confirmPassword: string;
    username: string;
  };
  // Form state tracking
  isSubmitting: boolean;
  isOffline: boolean;
  submitAttempts: number;
  // Validation results
  validationResults: {
    email: boolean;
    password: boolean;
    confirmPassword: boolean;
    username: boolean;
  };
}

// Create a state machine to manage form validation and submission
const formStateMachine = new FluentState({
  initialState: "editing",
  debug: {
    logLevel: "info",
  },
});

// Initialize context
const initialContext: UserFormState = {
  values: {
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
  },
  isSubmitting: false,
  isOffline: false,
  submitAttempts: 0,
  validationResults: {
    email: false,
    password: false,
    confirmPassword: false,
    username: false,
  },
};

// Set initial context
formStateMachine.state.updateContext(initialContext);

// --- watchProperties Example ---
// Only evaluate when specific form fields change, not on every context update
formStateMachine.from("editing").to<UserFormState>("validating", {
  condition: (_, context) => {
    // Only transition when all fields have values to validate
    return Boolean(context.values.email && context.values.password && context.values.confirmPassword && context.values.username);
  },
  targetState: "validating",
  evaluationConfig: {
    // Only evaluate when these specific properties change
    watchProperties: ["values.email", "values.password", "values.confirmPassword", "values.username"],
  },
});

// --- skipIf Example ---
// Skip validation if we're offline to avoid unnecessary checks
formStateMachine
  .from("validating")
  .to<UserFormState>("valid", {
    condition: (_, context) => {
      // Perform validation - in a real app, this could be more complex
      const emailValid = context.values.email.includes("@");
      const passwordValid = context.values.password.length >= 8;
      const confirmValid = context.values.password === context.values.confirmPassword;
      const usernameValid = context.values.username.length >= 3;

      // Update validation results
      context.validationResults = {
        email: emailValid,
        password: passwordValid,
        confirmPassword: confirmValid,
        username: usernameValid,
      };

      // Return overall validity
      return emailValid && passwordValid && confirmValid && usernameValid;
    },
    targetState: "valid",
    evaluationConfig: {
      // Skip validation when offline to avoid unnecessary processing
      skipIf: (context) => (context as UserFormState).isOffline,
    },
  })
  .or<UserFormState>("invalid", (_, context) => {
    // Always transition to invalid if validation failed
    return !(
      context.validationResults.email &&
      context.validationResults.password &&
      context.validationResults.confirmPassword &&
      context.validationResults.username
    );
  });

// --- evaluationStrategy Example ---
// Use nextTick for submission to give UI time to update
formStateMachine.from("valid").to<UserFormState>("submitting", {
  condition: (_, context) => context.isSubmitting,
  targetState: "submitting",
  evaluationConfig: {
    // Defer evaluation to the next event loop tick to give UI time to update
    evaluationStrategy: "nextTick",
  },
});

// Use idle time for non-critical operations
formStateMachine
  .from("submitting")
  .to<UserFormState>("success", {
    condition: async () => {
      // Simulate API call
      try {
        console.log("Submitting form data...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return true;
      } catch (error) {
        console.error("Error submitting form:", error);
        return false;
      }
    },
    targetState: "success",
    evaluationConfig: {
      // Use idle time for API calls and operations that aren't time-critical
      evaluationStrategy: "idle",
    },
  })
  .or<UserFormState>("error", (_, context) => context.submitAttempts > 3);

// --- Integration with other features ---
// Combining with debounce for email validation
formStateMachine.from("editing").to<UserFormState>("validatingEmail", {
  condition: (_, context) => Boolean(context.values.email),
  targetState: "validatingEmail",
  debounce: 500, // Wait 500ms after last keystroke before validating
  evaluationConfig: {
    watchProperties: ["values.email"],
  },
});

// Start the state machine
formStateMachine.start().then(() => {
  console.log("Form state machine started in state:", formStateMachine.state.name);

  // Simulate user interaction
  simulateUserInteraction();
});

// Simulate a user filling out the form
async function simulateUserInteraction() {
  console.log("\n--- Starting user interaction simulation ---");

  // User types email (triggers validatingEmail with debounce)
  console.log("\nUser typing email...");
  await formStateMachine.state.updateContext<UserFormState>({
    values: {
      ...formStateMachine.state.getContext<UserFormState>().values,
      email: "user@example",
    },
  });

  // Wait for debounce
  await new Promise((resolve) => setTimeout(resolve, 600));
  console.log("Current state:", formStateMachine.state.name);

  // User completes the form
  console.log("\nUser completing form...");
  await formStateMachine.state.updateContext<UserFormState>({
    values: {
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
      username: "testuser",
    },
  });

  // Should transition to validating
  await new Promise((resolve) => setTimeout(resolve, 100));
  console.log("Current state:", formStateMachine.state.name);

  // Go offline before validation completes
  console.log("\nDevice goes offline...");
  await formStateMachine.state.updateContext<UserFormState>({
    isOffline: true,
  });

  // Should skip validation due to skipIf
  await new Promise((resolve) => setTimeout(resolve, 100));
  console.log("Current state:", formStateMachine.state.name);

  // Go back online and redo validation
  console.log("\nDevice back online...");
  await formStateMachine.state.updateContext<UserFormState>({
    isOffline: false,
  });

  // Should complete validation now
  await new Promise((resolve) => setTimeout(resolve, 100));
  console.log("Current state:", formStateMachine.state.name);

  // Submit the form - this uses nextTick strategy
  console.log("\nUser submits form...");
  await formStateMachine.state.updateContext<UserFormState>({
    isSubmitting: true,
  });

  // Wait for nextTick and idle processing
  await new Promise((resolve) => setTimeout(resolve, 1200));
  console.log("Final state:", formStateMachine.state.name);

  console.log("\n--- User interaction simulation complete ---");
}
