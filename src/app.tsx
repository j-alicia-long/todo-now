import type { CSSProperties } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import TodoBase from "./tabs/todo-base";
import { CardsPage } from "./tabs/cards-page";
import { ThemeProvider } from "@/components/theme-provider";
import { isDemo } from "@/stores/default-transport";

const demoBadgeStyle: CSSProperties = {
  position: "fixed",
  bottom: 10,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 1000,
  padding: "4px 12px",
  borderRadius: 999,
  background: "rgba(60, 50, 40, 0.85)",
  color: "#faf6f1",
  fontSize: 12,
  pointerEvents: "none",
  whiteSpace: "nowrap",
};

const App = () => {
  return (
    <ThemeProvider defaultTheme="light">
      {/* Demo builds are served from BASE_URL (e.g. /todo-now/ on GitHub
          Pages); production is mounted at /todo by server.ts. */}
      <BrowserRouter basename={isDemo ? import.meta.env.BASE_URL : "/todo"}>
        <Routes>
          <Route path="/" element={<TodoBase />} />
          <Route path="/cards" element={<CardsPage />} />
        </Routes>
      </BrowserRouter>
      {isDemo && (
        <div style={demoBadgeStyle}>
          Demo — sample data, changes reset on reload
        </div>
      )}
    </ThemeProvider>
  );
};

export default App;
