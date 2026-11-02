import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AngoLeva CRM",
    short_name: "AngoLeva CRM",
    description: "Carteira de clientes, follow-up, campanhas e rota do dia do AngoLeva.",
    lang: "pt-AO",
    start_url: "/atividades",
    display: "standalone",
    background_color: "#161616",
    theme_color: "#161616",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
