import headerImg from "@/assets/header.jpg";

/**
 * The BarNerd wordmark, framed in gold.
 *
 * Shown at the top of the landing page and the completion screen. Kept as one component rather
 * than the same block pasted into both, so the frame cannot drift between the two surfaces —
 * this project has already lost a day to two copies of one artifact diverging.
 *
 * WHY THE FRAME: the image is 1280x591 and carries its own mid-green background, which is not
 * the page colour (#0e0e0e). Without a frame that edge reads as a stray rectangle; with it, the
 * green reads as a deliberate brand block.
 */
const Wordmark = () => (
  <div className="mx-auto w-full max-w-xs overflow-hidden rounded-xl border-2 border-gold/40">
    <img src={headerImg} alt="BarNerd" className="block w-full" />
  </div>
);

export default Wordmark;
