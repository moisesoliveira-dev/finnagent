"use client";

import { useEffect, useState } from "react";
import type { SessoesDoUsuario } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { Carregando } from "../../components/ui/esqueleto";
import { List } from "../../components/ui/list";
import { ListRow } from "../../components/ui/list-row";
import { useToast } from "../../components/ui/toast";
import { Vazio } from "../../components/ui/vazio";
import { chamar, dataCurta } from "./api";

export function AbaDeSessoes({ somenteLeitura }: { somenteLeitura: boolean }) {
  const toast = useToast();
  const [dados, setDados] = useState<SessoesDoUsuario | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  useEffect(() => {
    let ativo = true;
    chamar<SessoesDoUsuario>("/api/perfil/sessoes")
      .then((resposta) => {
        if (ativo) setDados(resposta);
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

  async function encerrarOutras() {
    setEncerrando(true);
    try {
      const resposta = await chamar<{ sessoesEncerradas: number }>("/api/perfil/sessoes/encerrar-outras", {
        method: "POST",
      });
      const lista = await chamar<SessoesDoUsuario>("/api/perfil/sessoes");
      setDados(lista);
      toast.sucesso(
        resposta.sessoesEncerradas === 1
          ? "1 sessão encerrada."
          : `${resposta.sessoesEncerradas} sessões encerradas.`,
      );
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível encerrar as sessões.");
    } finally {
      setEncerrando(false);
    }
  }

  if (!dados) return falhou ? null : <Carregando texto="Carregando as sessões." linhas={3} />;
  const outras = dados.sessions.filter((sessao) => !sessao.current).length;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h3 className="font-display text-lg">Onde você entrou</h3>
          <p className="max-w-prose text-sm text-ink-2">
            Cada linha é um aparelho com a sessão aberta. Se não reconhecer um deles, encerre as outras e troque a senha.
          </p>
        </div>
        <Button
          variant="danger"
          carregando={encerrando}
          disabled={somenteLeitura || outras === 0}
          onClick={() => void encerrarOutras()}
        >
          {encerrando ? "Encerrando" : "Encerrar as outras"}
        </Button>
      </div>
      {dados.sessions.length === 0 ? (
        <Vazio>Nenhuma sessão aberta.</Vazio>
      ) : (
        <List animada>
          {dados.sessions.map((sessao) => (
            <ListRow
              key={sessao.ref}
              animado
              title={sessao.device}
              meta={
                <>
                  {sessao.current ? <Chip tone="ok">Este aparelho</Chip> : null}
                  <span>Entrou em {dataCurta(sessao.createdAt)}</span>
                </>
              }
              value={<span className="text-sm text-ink-2">Vale até {dataCurta(sessao.expiresAt)}</span>}
            />
          ))}
        </List>
      )}
    </div>
  );
}
