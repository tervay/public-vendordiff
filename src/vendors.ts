export type Vendor = {
  slug: string;
  name: string;
  platform: "shopify" | "rev";
  url: string;
  icon: string;
  ignoredShopifyVendors?: string[];
  combinedListings?: boolean;
};

export const vendors: Vendor[] = [
  { slug: "andymark", name: "AndyMark", platform: "shopify", url: "https://www.andymark.com", icon: "/vendors/andymark.png", combinedListings: true },
  { slug: "armabot", name: "Armabot", platform: "shopify", url: "https://www.armabot.com", icon: "/vendors/armabot.png" },
  { slug: "ctre", name: "CTRE", platform: "shopify", url: "https://store.ctr-electronics.com", icon: "/vendors/ctre.png" },
  { slug: "lastanvil", name: "Last Anvil", platform: "shopify", url: "https://lastanvil.com", icon: "/vendors/lastanvil.png" },
  { slug: "limelight", name: "Limelight", platform: "shopify", url: "https://limelightvision.io", icon: "/vendors/limelight.png" },
  { slug: "rev", name: "REV Robotics", platform: "rev", url: "https://dashboard.revrobotics.com/feeds/usa/products.json", icon: "/vendors/rev.ico" },
  { slug: "sds", name: "Swerve Drive Specialties", platform: "shopify", url: "https://www.swervedrivespecialties.com", icon: "/vendors/sds.png" },
  { slug: "swyft", name: "Swyft Robotics", platform: "shopify", url: "https://shop.swyftrobotics.com", icon: "/vendors/swyft.png" },
  { slug: "thriftybot", name: "The Thrifty Bot", platform: "shopify", url: "https://thethriftybot.com", icon: "/vendors/thriftybot.png" },
  { slug: "wcp", name: "WCP", platform: "shopify", url: "https://wcproducts.com", icon: "/vendors/wcp.png", ignoredShopifyVendors: ["N/A"] },
];

export const vendorBySlug = (slug: string) => vendors.find((v) => v.slug === slug);
