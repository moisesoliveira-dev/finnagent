"use client";

import { useEffect, useState } from "react";
import type { PerfilDoUsuario } from "@finnagent/contracts";
import { PERFIL_ATUALIZADO } from "../../components/auth/perfil-evento";
import { Carregando } from "../../components/ui/esqueleto";
import { Cascata, Passo, Troca } from "../../components/ui/movimento";
import { PageHeader } from "../../components/ui/page-header";
import { Segmentado } from "../../components/ui/segmentado";
import { useToast } from "../../components/ui/toast";
import { chamar } from "./api";
import { AbaDoPerfil } from "./aba-perfil";
import { AbaDeSeguranca } from "./aba-seguranca";
import { AbaDeSessoes } from "./aba-sessoes";
import { CartaoDoPerfil, type DadosDoCartao } from "./cartao";

type Aba = "perfil" | "seguranca" | "sessoes";

const ABAS: { id: Aba; label: string }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "seguranca", label: "Segurança" },
  { id: "sessoes", label: "Sessões" },
];

function dadosDe(perfil: PerfilDoUsuario): DadosDoCartao {
  return {
    name: perfil.name,
    headline: perfil.headline,
    location: perfil.location,
    bio: perfil.bio,
    avatarTone: perfil.avatarTone,
  };
}

export default function Perfil() {
  const toast = useToast();
  const [perfil, setPerfil] = useState<PerfilDoUsuario | null>(null);
  const [rascunho, setRascunho] = useState<DadosDoCartao | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aba, setAba] = useState<Aba>("perfil");
  const [deslize, setDeslize] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    chamar<PerfilDoUsuario>("/api/perfil")
      .then((resposta) => {
        if (!ativo) return;
        setPerfil(resposta);
        setRascunho(dadosDe(resposta));
      })
      .catch((error: Error) => {
        if (!ativo) return;
        setFalhou(true);
        toast.erro(error.message);
      });
    return () => {
      ativo = false;
    };
  }, [toast]);

  async function salvar() {
    if (!rascunho || salvando) return;
    setErro("");
    setSalvando(true);
    try {
      const salvo = await chamar<PerfilDoUsuario>("/api/perfil", { method: "PATCH", body: JSON.stringify(rascunho) });
      setPerfil(salvo);
      setRascunho(dadosDe(salvo));
      window.dispatchEvent(new CustomEvent(PERFIL_ATUALIZADO, { detail: salvo }));
      toast.sucesso("Perfil salvo.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o perfil.");
    } finally {
      setSalvando(false);
    }
  }

  const original = perfil ? dadosDe(perfil) : null;
  const alterado = Boolean(
    rascunho && original && (Object.keys(original) as (keyof DadosDoCartao)[]).some((campo) => rascunho[campo] !== original[campo]),
  );
  const somenteLeitura = Boolean(perfil?.semLogin);

  return (
    <>
      <PageHeader title="Perfil" subtitle="Do jeito que você aparece para quem divide a conta com você." />

      {!perfil || !rascunho ? (
        falhou ? null : <Carregando texto="Carregando o perfil." titulo linhas={3} />
      ) : (
        <Cascata className="grid min-w-0 gap-6 desk:grid-cols-3">
          <Passo className="min-w-0 desk:sticky desk:top-8 desk:col-span-1 desk:self-start">
            <CartaoDoPerfil
              dados={rascunho}
              email={perfil.email}
              role={perfil.role}
              createdAt={perfil.createdAt}
              alterado={alterado}
            />
          </Passo>

          <Passo className="grid min-w-0 content-start gap-6 desk:col-span-2">
            {somenteLeitura ? (
              <p role="status" className="border border-pending-line bg-pending-soft px-4 py-3 text-sm text-pending">
                Você entrou sem login, em modo de desenvolvimento. O perfil é só de leitura. Cadastre uma conta para
                editá-lo.
              </p>
            ) : null}
            <Segmentado
              aria-label="Seções do perfil"
              opcoes={ABAS}
              valor={aba}
              onEscolher={(id, direcao) => {
                setDeslize(direcao);
                setAba(id);
              }}
            />
            <Troca id={aba} direcao={deslize} className="min-w-0">
              {aba === "perfil" ? (
                <AbaDoPerfil
                  rascunho={rascunho}
                  email={perfil.email}
                  somenteLeitura={somenteLeitura}
                  alterado={alterado}
                  salvando={salvando}
                  erro={erro}
                  onMudar={(parcial) => {
                    setErro("");
                    setRascunho({ ...rascunho, ...parcial });
                  }}
                  onSalvar={() => void salvar()}
                  onDescartar={() => {
                    setErro("");
                    setRascunho(dadosDe(perfil));
                  }}
                />
              ) : aba === "seguranca" ? (
                <AbaDeSeguranca somenteLeitura={somenteLeitura} />
              ) : (
                <AbaDeSessoes somenteLeitura={somenteLeitura} />
              )}
            </Troca>
          </Passo>
        </Cascata>
      )}
    </>
  );
}
