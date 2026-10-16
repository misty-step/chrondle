import { permanentRedirect } from "next/navigation";

export default function ReleasesPage() {
  permanentRedirect("/changelog");
}
