import { Link } from "react-router-dom";
import MartiniMark from "@/components/MartiniMark";
import MenuCard from "@/components/MenuCard";
import PartyAsk from "@/components/PartyAsk";
import { ABOUT_COPY } from "@/data/aboutCopy";

/**
 * About — the full version, one of the five lounge entries.
 *
 * SAME OBJECT, DIFFERENT RHYTHM: the card, the mark, the tokens and the page turn are the
 * room's. The only difference is that the rooms are four labelled sections and this is four
 * paragraphs, because a visitor who opens a room wants to know about that room, and someone
 * who opens About wants to read.
 *
 * THE ASK IS HERE TOO, and it is the same component that closes every room. About is the
 * page where a visitor most plausibly wants to leave a contact, so the form is the last
 * thing on it rather than a separate "contact" page.
 */
const About = () => (
  <div className="relative flex min-h-screen items-start justify-center overflow-x-clip px-6 py-12">
    <div className="grain" />
    <MenuCard className="w-full max-w-md space-y-5">
      <MartiniMark />

      <h1 className="font-display text-3xl font-bold text-gold">{ABOUT_COPY.title}</h1>

      {ABOUT_COPY.paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 24)} className="font-body text-sm leading-relaxed text-cream">
          {paragraph}
        </p>
      ))}

      <PartyAsk />

      <Link
        to="/"
        className="inline-flex min-h-[44px] items-center font-body text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-gold"
      >
        back to the hub
      </Link>
    </MenuCard>
  </div>
);

export default About;
