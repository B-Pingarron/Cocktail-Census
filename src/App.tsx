import { BrowserRouter, Routes, Route } from "react-router-dom";
import Census from "@/pages/Census";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Census />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
