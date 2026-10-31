import { Cormorant_Garamond, DM_Serif_Display, Inter, Manrope, Montserrat, Playfair_Display, Poppins } from "next/font/google";

/*
 * Landing page fonts. next/font downloads them at build time and serves them
 * from this app, so visitors make no requests to Google. Each font only
 * defines a CSS variable; the theme (theme.ts FONT_STACKS) decides which one
 * a page uses, and browsers download only the font files a page renders.
 */
const playfair = Playfair_Display({subsets: ["latin"], variable: "--font-pg-playfair", display: "swap"});
const cormorant = Cormorant_Garamond({subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-pg-cormorant", display: "swap"});
const dmSerif = DM_Serif_Display({subsets: ["latin"], weight: "400", variable: "--font-pg-dm-serif", display: "swap"});
const inter = Inter({subsets: ["latin"], variable: "--font-pg-inter", display: "swap"});
const manrope = Manrope({subsets: ["latin"], variable: "--font-pg-manrope", display: "swap"});
const montserrat = Montserrat({subsets: ["latin"], variable: "--font-pg-montserrat", display: "swap"});
const poppins = Poppins({subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-pg-poppins", display: "swap"});

/** Put this class on any element that renders a landing page. */
export const pageFontVariables = [playfair, cormorant, dmSerif, inter, manrope, montserrat, poppins].map(font => font.variable).join(" ");
