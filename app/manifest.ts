import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alimenta Angola CRM",
    short_name: "Alimenta CRM",
    description: "Carteira de clientes, follow-up, vendas e rota do dia da Alimenta Angola — Cash and Carry.",
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
