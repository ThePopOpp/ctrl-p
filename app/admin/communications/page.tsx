import { AdminCommunications } from "@/components/admin/admin-communications";

export const metadata = {
  title: "Communications | Ctrl+P Admin",
  description: "Voice calls, SMS, contacts, and AI voice powered by Twilio.",
};

export default function Page() {
  return <AdminCommunications />;
}
