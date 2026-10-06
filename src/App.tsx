import { HashRouter, Routes, Route } from "react-router-dom";
import About from "@/pages/About";
import Census from "@/pages/Census";
import Hub from "@/pages/Hub";
import CensusIntroPage from "@/pages/CensusIntroPage";
import LearnMore from "@/pages/LearnMore";
import RoastDeck from "@/pages/RoastDeck";
import RoastEnter from "@/pages/RoastEnter";
import RoastMenu from "@/pages/RoastMenu";
import RoastVerdict from "@/pages/RoastVerdict";
import Room from "@/pages/Room";

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
        <Route path="/census" element={<CensusIntroPage />} />
          <Route path="/census/learn-more" element={<LearnMore />} />
        <Route path="/census/vote" element={<Census />} />
        <Route path="/roast/enter" element={<RoastEnter />} />
        {/*
         * The ROAST menu, added 2026-10-05. It is the room's front door for anyone who has roasted
         * something; a Session that has not is sent to /roast/enter instead (see RoastMenu).
         */}
        <Route path="/roast" element={<RoastMenu />} />
        <Route path="/roast/deck" element={<RoastDeck />} />
        {/*
         * TWO ROUTES, ONE PAGE. The grill session of 2026-10-05 made this the Review page — a
         * destination reachable from the menu, not only the place the deck ends. `/roast/review` is
         * the name that matches the glossary and the menu; `/roast/verdict` is kept because it is
         * already deployed and linked from a shipped screen, and a route that 404s is a worse bug
         * than a route with two names.
         */}
        <Route path="/roast/review" element={<RoastVerdict />} />
        <Route path="/roast/verdict" element={<RoastVerdict />} />
        {/*
         * The four room explainers. One route, the room out of the URL, the copy out of
         * data/roomCopy — so a room is a data entry, not a page component.
         */}
        <Route path="/room/:room" element={<Room />} />
        {/* About is reachable from the lounge, never from the cover. */}
        <Route path="/about" element={<About />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
