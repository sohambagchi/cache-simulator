import { StoreProvider } from "./state/store";

export function App() {
  return (
    <StoreProvider>
      <main className="app-shell">
        <h1>Multi-Level Cache Simulator</h1>
      </main>
    </StoreProvider>
  );
}
