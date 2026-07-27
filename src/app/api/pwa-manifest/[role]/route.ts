import { NextRequest, NextResponse } from "next/server";

const ROLE_MANIFESTS = {
  manager: {
    name: "CASA Manager",
    short_name: "CASA Manager",
    start_url: "/MANAGER",
    id: "/MANAGER",
    description: "CASA manager login and dashboard entry point.",
    theme_color: "#d97706",
    background_color: "#fff7ed",
  },
  director: {
    name: "CASA MD Dashboard",
    short_name: "CASA MD",
    start_url: "/MD?source=pwa",
    scope: "/",
    id: "/mawio-md-dashboard",
    description: "CASA managing director mobile dashboard.",
    theme_color: "#065f46",
    background_color: "#f4f7f2",
  },
  inventory: {
    name: "CASA Inventory",
    short_name: "CASA Inventory",
    start_url: "/IM",
    id: "/IM",
    description: "CASA inventory login and stock control entry point.",
    theme_color: "#111827",
    background_color: "#f9fafb",
  },
  cashier: {
    name: "CASA Reception",
    short_name: "CASA Reception",
    start_url: "/RB",
    id: "/RB",
    description: "CASA reception booking login and dashboard entry point.",
    theme_color: "#ea580c",
    background_color: "#fff7ed",
  },
  kitchen: {
    name: "CASA Kitchen POS",
    short_name: "CASA Kitchen",
    start_url: "/KP",
    id: "/KP",
    description: "CASA kitchen POS login and dashboard entry point.",
    theme_color: "#c2410c",
    background_color: "#fff7ed",
  },
  barista: {
    name: "CASA Barista POS",
    short_name: "CASA Barista",
    start_url: "/BP",
    id: "/BP",
    description: "CASA barista POS login and dashboard entry point.",
    theme_color: "#fb923c",
    background_color: "#fff7ed",
  },
} as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ role: string }> },
) {
  const { role } = await context.params;
  const manifest = ROLE_MANIFESTS[role as keyof typeof ROLE_MANIFESTS];

  if (!manifest) {
    return NextResponse.json({ error: "Manifest not found." }, { status: 404 });
  }



  return new NextResponse(
    JSON.stringify({
      ...manifest,
      name: manifest.name,
      short_name: manifest.short_name,
      display: "standalone",
      display_override: ["standalone", "minimal-ui"],
      start_url: manifest.start_url,
      scope: manifest.start_url,
      id: manifest.start_url,
      background_color: manifest.background_color,
      theme_color: manifest.theme_color,
      categories: ["business", "productivity"],
      prefer_related_applications: false,
      orientation: "portrait-primary",
      icons: [
        {
          src: "/casa-logo.svg",
          sizes: "192x192",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
        {
          src: "/casa-logo.svg",
          sizes: "512x512",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    }),
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
