export type Vendor = {
  slug: string;
  name: string;
  platform: "shopify" | "rev";
  url: string;
  ignoredShopifyVendors?: string[];
};

export const vendors: Vendor[] = [
  { slug: "andymark", name: "AndyMark", platform: "shopify", url: "https://www.andymark.com" },
  { slug: "armabot", name: "Armabot", platform: "shopify", url: "https://www.armabot.com" },
  { slug: "ctre", name: "CTRE", platform: "shopify", url: "https://store.ctr-electronics.com" },
  { slug: "lastanvil", name: "Last Anvil", platform: "shopify", url: "https://lastanvil.com" },
  { slug: "limelight", name: "Limelight", platform: "shopify", url: "https://limelightvision.io" },
  { slug: "rev", name: "REV Robotics", platform: "rev", url: "https://dashboard.revrobotics.com/feeds/usa/products.json" },
  { slug: "sds", name: "Swerve Drive Specialties", platform: "shopify", url: "https://www.swervedrivespecialties.com" },
  { slug: "swyft", name: "Swyft Robotics", platform: "shopify", url: "https://shop.swyftrobotics.com" },
  { slug: "thriftybot", name: "The Thrifty Bot", platform: "shopify", url: "https://thethriftybot.com" },
  { slug: "wcp", name: "WCP", platform: "shopify", url: "https://wcproducts.com", ignoredShopifyVendors: ["N/A"] },
];

export const vendorBySlug = (slug: string) => vendors.find((v) => v.slug === slug);
