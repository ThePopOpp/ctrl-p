import {
  BookOpen,
  Bot,
  Boxes,
  CalendarCheck,
  CalendarRange,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PackageCheck,
  Palette,
  Phone,
  Radio,
  Settings,
  ShoppingBag,
  Tag,
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
      ["Projects", CalendarRange, "/admin/production-schedule"],
      ["Production", Boxes, "/admin/production"],
      ["Bookings", CalendarCheck, "/admin/bookings"],
      ["Designers", Palette, "/admin/designers"],
      ["Payments", CircleDollarSign, "/admin/payments"],
      ["Messages", MessageSquare, "/admin/messages"],
      ["Communications", Phone, "/admin/communications"],
      ["Customers", Users, "/admin/customers"],
      ["Users", UserCog, "/admin/users"],
    ],
  },
  {
    label: "Catalog",
    items: [
      ["Products", PackageCheck, "/admin/products"],
      ["Coupons", Tag, "/admin/coupons"],
      ["Artwork", FileText, "/admin/artwork"],
      ["Shipping", Truck, "/admin/shipments"],
      ["Marketing", Megaphone, "/admin/marketing"],
      ["Content", BookOpen, "/admin/content"],
    ],
  },
  {
    label: "System",
    items: [
      ["Agent", Bot, "/admin/agent"],
      ["Settings", Settings, "/admin/settings"],
    ],
  },
];

export function isAdminNavActive(label: string, pathname: string) {
  if (label === "Dashboard") return pathname === "/admin";
  return adminNavGroups
    .flatMap((group) => group.items)
    .some(([itemLabel, , href]) => itemLabel === label && pathname === href);
}
