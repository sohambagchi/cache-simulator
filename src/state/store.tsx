import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import type { Action } from "./actions";
import { initialAppState, reducer, type AppState } from "./reducer";

type StoreValue = {
  state: AppState;
  dispatch: Dispatch<Action>;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialAppState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error("useStore must be used within StoreProvider");
  }

  return context;
}
