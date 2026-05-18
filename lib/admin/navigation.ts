import {
  Boxes,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PackageCheck,
  Radio,
  Settings,
  ShoppingBag,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AdminNavItem = readonly [label: string, Icon: LucideIcon, href: string];

export const adminNavGroups: readonly {
  label: string;
  items: readonly AdminNavItem[];
}[] = [
  {
    label: "Main",
    items: [
      ["Dashboard", LayoutDashboard, "/admin"],
      ["Analytics", Radio, "/admin/analytics"],
      ["Orders", ShoppingBag, "/admin/orders"],
      ["Production", Boxes, "/admin/production"],
      ["Payments", CircleDollarSign, "/admin/payments"],
      ["Messages", MessageSquare, "/admin/messages"],
      ["Customers", Users, "/admin/customers"],
      ["Users", UserCog, "/admin/users"],
    ],
  },
  {
    label: "Catalog",
    items: [
      ["Products", PackageCheck, "/admin/products"],
      ["Artwork", FileText, "/admin/artwork"],
      ["Shipments", Truck, "/admin/shipments"],
      ["Marketing", Megaphone, "/admin/marketing"],
    ],
  },
  {
    label: "System",
    items: [["Settings", Settings, "/admin/settings"]],
  },
];

export function isAdminNavActive(label: string, pathname: string) {
  if (label === "Dashboard") return pathname === "/admin";
  return adminNavGroups
    .flatMap((group) => group.items)
    .some(([itemLabel, , href]) => itemLabel === label && pathname === href);
}
