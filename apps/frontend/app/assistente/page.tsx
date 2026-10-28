import type { Metadata } from "next";
import { Chat } from "./chat";

export const metadata: Metadata = { title: "Assistente · Prumo" };

export default function AssistentePagina() {
  return <Chat />;
}
