import { BrowserRouter, Route, Routes } from "react-router-dom";
import TodoBase from "./tabs/TodoBase";
import { ThemeProvider } from "@/components/theme-provider";

export default function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <BrowserRouter basename="/todo">
        <Routes>
          <Route path="/" element={<TodoBase />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
