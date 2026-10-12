"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Aparecer, indiceDaAba } from "../components/ui/movimento";

let pronta = false;
let ultimaAba = 0;

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const indice = indiceDaAba(pathname);
  const direcao = !pronta || indice === ultimaAba ? 0 : indice > ultimaAba ? 1 : -1;

  useEffect(() => {
    pronta = true;
    ultimaAba = indice;
  }, [indice]);

  return (
    <Aparecer className="min-w-0" direcao={direcao}>
      {children}
    </Aparecer>
  );
}
