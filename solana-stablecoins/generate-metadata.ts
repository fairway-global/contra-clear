/**
 * generate-metadata.ts
 * 
 * Generates off-chain metadata JSON files + embedded SVG icons for each
 * mock stablecoin. These follow the Metaplex Token Metadata standard so
 * Phantom, Solflare, etc. display icons correctly.
 * 
 * USAGE:
 *   npx tsx generate-metadata.ts
 * 
 * This creates a /metadata folder with:
 *   metadata/USDC.json   — off-chain metadata with embedded SVG data URI
 *   metadata/USDT.json
 *   metadata/CHF.json
 *   ... etc
 * 
 * You then need to HOST these files somewhere publicly accessible:
 *   Option A: GitHub Pages / raw.githubusercontent.com
 *   Option B: Arweave (permanent, ~free for small files)
 *   Option C: npoint.io (free JSON hosting, no signup)
 *   Option D: Local server for dev (included below)
 * 
 * After hosting, update the URIs in create-mocks-with-metadata.ts
 * and re-run the mint creation.
 */

import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = "metadata";

// ============================================================================
// SVG Icon Generator — creates a clean, recognizable currency icon
// ============================================================================

interface CoinDesign {
  symbol: string;
  name: string;
  description: string;
  bgColor: string;      // circle background
  textColor: string;     // symbol text color
  accentColor: string;   // ring/accent
  currencySign: string;  // $ € £ ¥ etc for the icon
  svgOverride?: string;  // custom SVG inner content (for non-Latin symbols)
}

const COIN_DESIGNS: CoinDesign[] = [
  {
    symbol: "USDC",
    name: "USD Coin (Mock)",
    description: "Mock USDC stablecoin for OTC desk testing on Solana devnet",
    bgColor: "#2775CA",
    textColor: "#FFFFFF",
    accentColor: "#1A5DAB",
    currencySign: "$",
  },
  {
    symbol: "USDT",
    name: "Tether USD (Mock)",
    description: "Mock USDT stablecoin for OTC desk testing on Solana devnet",
    bgColor: "#26A17B",
    textColor: "#FFFFFF",
    accentColor: "#1A8A68",
    currencySign: "₮",
  },
  {
    symbol: "EURC",
    name: "Euro Coin (Mock)",
    description: "Mock EURC euro stablecoin for OTC desk testing on Solana devnet",
    bgColor: "#0052FF",
    textColor: "#FFFFFF",
    accentColor: "#003ACC",
    currencySign: "€",
  },
  {
    symbol: "PYUSD",
    name: "PayPal USD (Mock)",
    description: "Mock PYUSD stablecoin for OTC desk testing on Solana devnet",
    bgColor: "#0070E0",
    textColor: "#FFFFFF",
    accentColor: "#003087",
    currencySign: "$",
  },
  {
    symbol: "USDG",
    name: "Global Dollar (Mock)",
    description: "Mock USDG stablecoin for OTC desk testing on Solana devnet",
    bgColor: "#1B1B3A",
    textColor: "#00E5A0",
    accentColor: "#00B880",
    currencySign: "$",
  },
  {
    symbol: "CHF",
    name: "Swiss Franc Stable (Mock)",
    description: "Mock Swiss Franc stablecoin for OTC desk testing on Solana devnet",
    bgColor: "#D52B1E",
    textColor: "#FFFFFF",
    accentColor: "#A82218",
    currencySign: "Fr",
  },
  {
    symbol: "GBP",
    name: "British Pound Stable (Mock)",
    description: "Mock British Pound stablecoin for OTC desk testing on Solana devnet",
    bgColor: "#1D2951",
    textColor: "#FFFFFF",
    accentColor: "#C8A951",
    currencySign: "£",
  },
  {
    symbol: "JPY",
    name: "Japanese Yen Stable (Mock)",
    description: "Mock Japanese Yen stablecoin for OTC desk testing on Solana devnet",
    bgColor: "#BC002D",
    textColor: "#FFFFFF",
    accentColor: "#8C0022",
    currencySign: "¥",
    svgOverride: [
      // ¥ as SVG paths — Phantom can't render ¥ as text
      '<path d="M78,50 L128,118" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" fill="none"/>',
      '<path d="M178,50 L128,118" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" fill="none"/>',
      '<line x1="128" y1="118" x2="128" y2="210" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round"/>',
      '<line x1="88" y1="140" x2="168" y2="140" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>',
      '<line x1="88" y1="168" x2="168" y2="168" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>',
    ].join("\n  "),
  },
  {
    symbol: "SGD",
    name: "Singapore Dollar Stable (Mock)",
    description: "Mock Singapore Dollar stablecoin for OTC desk testing on Solana devnet",
    bgColor: "#EF3340",
    textColor: "#FFFFFF",
    accentColor: "#C41E2A",
    currencySign: "S$",
  },
  {
    symbol: "AED",
    name: "UAE Dirham Stable (Mock)",
    description: "Mock UAE Dirham stablecoin for OTC desk testing on Solana devnet",
    bgColor: "#006233",
    textColor: "#FFFFFF",
    accentColor: "#004D28",
    currencySign: "AED",
  },
  {
    symbol: "USX",
    name: "USX (Mock)",
    description: "Mock USX Solstice synthetic stablecoin for OTC desk testing on Solana devnet",
    bgColor: "#0A0F1E",
    textColor: "#00F0CC",
    accentColor: "#060B14",
    currencySign: "USX",
  },
];

function generateSVG(design: CoinDesign): string {
  // Large, bold font sizes — optimized for ~40px display in wallets
  const signFontSize = design.currencySign.length > 2 ? 80 : 120;

  const symbolContent = design.svgOverride
    ? design.svgOverride
    : `<text x="128" y="128" text-anchor="middle" dominant-baseline="central"
    font-family="'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
    font-size="${signFontSize}" font-weight="700" fill="${design.textColor}">${escapeXml(design.currencySign)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${design.bgColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${design.accentColor};stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="128" cy="128" r="128" fill="url(#bg)" />
  <circle cx="128" cy="128" r="116" fill="none" stroke="${design.textColor}" stroke-width="4" stroke-opacity="0.15" />
  ${symbolContent}
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================================
// Metaplex-compatible metadata JSON
// ============================================================================

interface TokenMetadataJSON {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  attributes: { trait_type: string; value: string }[];
}

function generateMetadataJSON(design: CoinDesign, imageUri: string): TokenMetadataJSON {
  return {
    name: design.name,
    symbol: design.symbol,
    description: design.description,
    image: imageUri,
    external_url: "https://github.com/your-org/otc-desk",
    attributes: [
      { trait_type: "Type", value: "Mock Stablecoin" },
      { trait_type: "Peg", value: design.currencySign },
      { trait_type: "Network", value: "Solana Devnet" },
      { trait_type: "Decimals", value: "6" },
      { trait_type: "Program", value: "Token-2022" },
    ],
  };
}

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Mock Stablecoin Metadata & Icon Generator   ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results: Record<string, string> = {};

  for (const design of COIN_DESIGNS) {
    console.log(`  ${design.symbol.padEnd(8)} — ${design.name}`);

    // Generate SVG
    const svg = generateSVG(design);
    const svgPath = path.join(OUTPUT_DIR, `${design.symbol}.svg`);
    fs.writeFileSync(svgPath, svg);

    // Use hosted SVG URL (data URIs don't work in Phantom/Solflare)
    const hostedImageUrl = `https://raw.githubusercontent.com/fairway-global/otc-stablecoins/main/metadata/${design.symbol}.png`;

    // Generate metadata JSON with hosted SVG URL
    const metadata = generateMetadataJSON(design, hostedImageUrl);
    const embeddedPath = path.join(OUTPUT_DIR, `${design.symbol}.json`);
    fs.writeFileSync(embeddedPath, JSON.stringify(metadata, null, 2));

    // Also generate a .hosted.json copy (identical now)
    const hostedPath = path.join(OUTPUT_DIR, `${design.symbol}.hosted.json`);
    fs.writeFileSync(hostedPath, JSON.stringify(metadata, null, 2));

    results[design.symbol] = embeddedPath;
    console.log(`           ✅ ${svgPath}, ${embeddedPath}`);
  }

  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("Generated files in ./metadata/:");
  console.log("  *.svg          — Icon files (SVG)");
  console.log("  *.json         — Metadata with embedded SVG data URI");
  console.log("  *.hosted.json  — Metadata pointing to GitHub-hosted SVGs");
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("NEXT STEPS — Choose how to host the metadata:");
  console.log("");
  console.log("  Option A: GitHub (recommended for devnet)");
  console.log("  ─────────────────────────────────────────");
  console.log("  1. Push the /metadata folder to a GitHub repo");
  console.log("  2. Edit *.hosted.json — replace YOUR_USER/YOUR_REPO");
  console.log("  3. Use the raw.githubusercontent.com URLs as your URIs");
  console.log("");
  console.log("  Option B: npoint.io (zero setup, free)");
  console.log("  ─────────────────────────────────────────");
  console.log("  1. Go to npoint.io/new");
  console.log("  2. Paste contents of each *.json file");
  console.log("  3. Save → get a URL like https://api.npoint.io/abc123");
  console.log("  4. Use that URL as the metadata URI");
  console.log("");
  console.log("  Option C: Local server (quick dev testing)");
  console.log("  ─────────────────────────────────────────");
  console.log("  npx serve ./metadata --cors -l 8080");
  console.log("  URI = http://localhost:8080/USDC.json");
  console.log("  ⚠️  Only works while server is running");
  console.log("");
  console.log("Then update STABLECOINS array in create-mocks-with-metadata.ts");
  console.log("with the hosted URLs and re-run the mint creation.");
  console.log("");
}

main();
