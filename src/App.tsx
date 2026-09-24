import { HashRouter, Routes, Route } from "react-router-dom";
import Census from "@/pages/Census";
import ComingSoon from "@/pages/ComingSoon";
import Hub from "@/pages/Hub";
import Landing from "@/pages/Landing";
import LearnMore from "@/pages/LearnMore";
import RoastEnter from "@/pages/RoastEnter";

/**
 * WHY THERE IS NO ROUTE-TRANSITION WRAPPER HERE:
 *   A page change in this product is a page of the menu arriving, and that belongs to the card
 *   rather than to the router. MenuCard turns itself in on mount, so every page that is a page
 *   of the menu gets the turn for free, including rooms added later, and no wrapper has to know
 *   about routing. The first attempt put a sheet over the route change instead; a frozen frame
 *   of it was a blank full-screen rectangle, which reads as loading rather than as turning.
 */
const App = () => {
  return (
    <HashRouter>
      <Routes>
        {/*
         * The hub now exists at / (D5: one origin — hub at /, census at /census). The site root
         * is the cover and the lounge, not a redirect: a link to the root lands on the front door,
         * and every room hangs off it.
         */}
        <Route path="/" element={<Hub />} />
        <Route path="/census" element={<Landing />} />
          <Route path="/census/learn-more" element={<LearnMore />} />
        <Route path="/census/vote" element={<Census />} />
        <Route path="/roast/enter" element={<RoastEnter />} />
        {/*
         * Every not-yet-built room lands on the same page, which reads its own name out of the
         * URL. One route covers /soon/census, /soon/roast, /soon/compositor, /soon/recipe-manager
         * and /soon/about without five near-identical entries.
         */}
        <Route path="/soon/:room" element={<ComingSoon />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
