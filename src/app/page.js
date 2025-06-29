import Home from "@/components/Home/Home";
import { redirect } from "next/navigation";

export default function Index() {
  redirect("/reader?book=intro");
  // return <Home />;
}
