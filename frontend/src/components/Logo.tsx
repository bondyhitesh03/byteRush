// The ByteRush mark (transparent PNG made from the official logo).
export default function Logo({ size = 28 }: { size?: number }) {
  return <img className="logomark" src="/logo-mark.png" width={size} height={size} alt="ByteRush logo" draggable={false} />;
}
