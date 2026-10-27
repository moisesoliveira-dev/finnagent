import type { Metadata } from "next";
import { destinoSeguro } from "../../components/auth/destino";
import { FormularioDeAcesso } from "../../components/auth/formulario-de-acesso";

export const metadata: Metadata = { title: "Criar conta · Prumo" };

export default async function CadastroPagina({ searchParams }: PageProps<"/cadastro">) {
  const params = await searchParams;
  return (
    <FormularioDeAcesso modo="cadastro" proximo={destinoSeguro(params.proximo)} />
  );
}
