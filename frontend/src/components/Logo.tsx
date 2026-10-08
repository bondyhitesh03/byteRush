// The ByteRush mark (same artwork as the favicon).
export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg className="logomark" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="ByteRush logo">
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7C3AED" /><stop offset=".55" stopColor="#2563EB" /><stop offset="1" stopColor="#06B6D4" /></linearGradient>
        <radialGradient id="lg-hot" cx="0" cy="1" r=".85"><stop offset="0" stopColor="#FF2E93" stopOpacity=".75" /><stop offset="1" stopColor="#FF2E93" stopOpacity="0" /></radialGradient>
        <linearGradient id="lg-bolt" x1="0" y1="0" x2="0" y2="1"><stop offset=".05" stopColor="#FFF59D" /><stop offset=".45" stopColor="#FFB300" /><stop offset=".95" stopColor="#FF2E93" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#lg-bg)" />
      <rect width="64" height="64" rx="15" fill="url(#lg-hot)" />
      <path d="M6 15h13M4 27h11M7 45h12" stroke="#fff" strokeOpacity=".6" strokeWidth="3.4" strokeLinecap="round" />
      <polygon className="logobolt" points="36,4 46,4 39,22 52,22 23,60 29,35 15,35" fill="url(#lg-bolt)" stroke="#12082B" strokeWidth="5" strokeLinejoin="round" paintOrder="stroke" />
    </svg>
  );
}
