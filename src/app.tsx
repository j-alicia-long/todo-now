import { BrowserRouter, Route, Routes } from "react-router-dom";
import TodoBase from "./tabs/todo-base";
import { ThemeProvider } from "@/components/theme-provider";

const App = () => {
  return (
    <ThemeProvider defaultTheme="light">
      <BrowserRouter basename="/todo">
        <Routes>
          <Route path="/" element={<TodoBase />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
