// Registers a DOM (happy-dom) globally before bun test runs, so hook tests
// can use @testing-library/react's renderHook.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// Let React's act() know it's running in a test environment.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
