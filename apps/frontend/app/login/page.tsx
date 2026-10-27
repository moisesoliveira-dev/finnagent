import { loginDispensado } from "@finnagent/contracts";
import type { Metadata } from "next";
import { destinoSeguro } from "../../components/auth/destino";
import { FormularioDeAcesso } from "../../components/auth/formulario-de-acesso";

export const metadata: Metadata = { title: "Entrar · Prumo" };

export default async function LoginPagina({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  return (
    <FormularioDeAcesso
      modo="entrar"
      proximo={destinoSeguro(params.proximo)}
      expirou={params.expirou !== undefined}
      semLogin={loginDispensado(process.env)}
    />
  );
}
