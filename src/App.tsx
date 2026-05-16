import { HashRouter, Routes, Route } from "react-router-dom";
import Census from "@/pages/Census";

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Census />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
