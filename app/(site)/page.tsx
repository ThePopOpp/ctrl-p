import { Slot } from "@/components/placements/slot";
import { HomePage } from "@/components/home/home-page";

// Slot contents come from the database, so this page cannot be frozen at build
// time — a placement made in the dashboard would never appear. ISR keeps it
// static-fast while picking up merchandising changes within the minute.
export const revalidate = 60;

// Both slots render nothing until staff place a card in them, so the homepage
// is byte-identical for customers until merchandising happens.
export default function Page() {
  return (
    <>
      <div className="mx-auto w-full max-w-7xl space-y-10 px-4 pt-8 empty:hidden sm:px-6 lg:px-8">
        <Slot slotKey="home_hero" />
        <Slot slotKey="home_featured" heading="Featured products" />
      </div>
      <HomePage />
    </>
  );
}
