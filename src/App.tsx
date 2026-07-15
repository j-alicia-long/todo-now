import { BrowserRouter, Route, Routes } from "react-router-dom";
import TodoPage from "./pages/TodoPage";
import { ThemeProvider } from "@/components/theme-provider";

export default function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <BrowserRouter basename="/todo">
        <Routes>
          <Route path="/" element={<TodoPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
