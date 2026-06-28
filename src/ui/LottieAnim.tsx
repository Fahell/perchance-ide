import { h } from "preact";
import { useEffect, useRef } from "preact/hooks";
import lottie from "lottie-web";

interface LottieAnimProps {
  /** URL to the Lottie JSON file */
  src: string;
  /** Size in px (width and height). Default: 24 */
  size?: number;
  /** Loop the animation. Default: true */
  loop?: boolean;
  /** Autoplay on mount. Default: true */
  autoplay?: boolean;
  /** Renderer: "svg" | "canvas" | "html". Default: "svg" */
  renderer?: "svg" | "canvas" | "html";
}

export function LottieAnim({
  src,
  size = 24,
  loop = true,
  autoplay = true,
  renderer = "svg",
}: LottieAnimProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<ReturnType<typeof lottie.loadAnimation> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer,
      loop,
      autoplay,
      path: src,
    });

    animRef.current = anim;

    return () => {
      anim.destroy();
      animRef.current = null;
    };
  }, [src, renderer]);

  // Update loop/autoplay dynamically
  useEffect(() => {
    const anim = animRef.current;
    if (!anim) return;
    anim.loop = loop;
    if (autoplay) anim.play();
    else anim.pause();
  }, [loop, autoplay]);

  return (
    <div
      ref={containerRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: "0",
      }}
    />
  );
}
