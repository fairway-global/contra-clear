import { getTokenImageUrl, getTokenSymbol } from '../../lib/constants';

interface TokenIconProps {
  mint: string;
  size?: number;
  className?: string;
}

export default function TokenIcon({ mint, size = 20, className = '' }: TokenIconProps) {
  const symbol = getTokenSymbol(mint);
  const imageUrl = getTokenImageUrl(mint);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={symbol}
        width={size}
        height={size}
        className={`rounded-full shrink-0 ${className}`}
        style={{ width: size, height: size }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  // Fallback: letter circle
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-terminal-accent/20 font-mono text-[10px] font-bold text-terminal-accent shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}
