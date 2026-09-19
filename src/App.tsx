import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Census from "@/pages/Census";
import Landing from "@/pages/Landing";

const App = () => {
  return (
    <HashRouter>
      <Routes>
        {/*
         * / is deliberately left free for the hub (D5: one origin — hub at /, census at
         * /census). Until the hub exists it redirects, so any existing link to the site
         * root still lands somewhere sensible.
         */}
        <Route path="/" element={<Navigate to="/census" replace />} />
        <Route path="/census" element={<Landing />} />
        <Route path="/census/vote" element={<Census />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
