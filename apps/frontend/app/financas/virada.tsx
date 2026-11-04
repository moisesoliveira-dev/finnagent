"use client";

import { useEffect, useState } from "react";
import type { ViradaResposta } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Dialogo } from "../../components/ui/dialogo";
import { caixaDeMarcar } from "../../components/ui/cn";
import { useToast } from "../../components/ui/toast";
import { api } from "./api";

type Pendente = Extract<ViradaResposta, { pendente: true }>;

export function ViradaDoAno() {
  const toast = useToast();
  const [virada, setVirada] = useState<Pendente | null>(null);
  const [grupos, setGrupos] = useState<string[]>([]);
  const [sessoes, setSessoes] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    api<ViradaResposta>("/api/grupos/virada")
      .then((resposta) => {
        if (!ativo || !resposta.pendente) return;
        setVirada(resposta);
        setGrupos(resposta.groups.map((group) => group.id));
        setSessoes(resposta.groups.flatMap((group) => group.sessions.map((session) => session.id)));
      })
      .catch((error: Error) => {
        if (ativo) toast.erro(error.message);
      });
    return () => {
      ativo = false;
    };
  }, [toast]);

  function alternarGrupo(id: string, marcado: boolean) {
    setGrupos((atual) => (marcado ? [...atual, id] : atual.filter((item) => item !== id)));
    if (!marcado && virada) {
      const ids = virada.groups.find((group) => group.id === id)?.sessions.map((session) => session.id) ?? [];
      setSessoes((atual) => atual.filter((item) => !ids.includes(item)));
    }
  }

  async function confirmar() {
    if (!virada || salvando) return;
    const groupIds = grupos;
    const sessionIds = virada.groups.flatMap((group) =>
      groupIds.includes(group.id)
        ? group.sessions.filter((session) => sessoes.includes(session.id)).map((session) => session.id)
        : [],
    );
    setSalvando(true);
    try {
      await api("/api/grupos/virada", {
        method: "POST",
        body: JSON.stringify({ year: virada.year, groupIds, sessionIds }),
      });
      toast.sucesso("Grupos e sessões atualizados para o ano novo.");
      setVirada(null);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível guardar a escolha.");
      setSalvando(false);
    }
  }

  // Aberto por estado: o Dialogo segura o conteúdo até o fim da saída.
  return (
    <Dialogo aberto={virada !== null} aria-labelledby="titulo-virada" onClose={() => setVirada(null)}>
      {virada ? (
        <>
          <h2 id="titulo-virada" className="mb-4 font-display text-lg">
            Revisar o ano {virada.year}
          </h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void confirmar();
            }}
          >
            <div className="dialog-corpo grid gap-4">
              <p>
                Tudo continua como está. Se algum grupo ou sessão acabou com o ano, desmarque: ele encerra em 31/12/
                {virada.year - 1}.
              </p>
              {virada.groups.length === 0 ? (
                <p className="text-sm text-ink-2">Não há grupo aberto para continuar.</p>
              ) : (
                virada.groups.map((group) => {
                  const grupoMarcado = grupos.includes(group.id);
                  return (
                    <fieldset key={group.id} className="grid gap-2">
                      <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          className={caixaDeMarcar}
                          checked={grupoMarcado}
                          onChange={(event) => alternarGrupo(group.id, event.target.checked)}
                        />
                        {group.name}
                      </label>
                      <div className="grid gap-1 pl-6">
                        {group.sessions.map((session) => (
                          <label key={session.id} className="flex min-h-10 items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className={caixaDeMarcar}
                              checked={grupoMarcado && sessoes.includes(session.id)}
                              disabled={!grupoMarcado}
                              onChange={(event) =>
                                setSessoes((atual) =>
                                  event.target.checked
                                    ? [...atual, session.id]
                                    : atual.filter((item) => item !== session.id),
                                )
                              }
                            />
                            {session.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                })
              )}
            </div>
            <div className="dialog-acoes">
              <Button type="button" variant="quiet" onClick={() => setVirada(null)} disabled={salvando}>
                Depois
              </Button>
              <Button type="submit" variant="primary" disabled={salvando}>
                Manter o que está marcado
              </Button>
            </div>
          </form>
        </>
      ) : null}
    </Dialogo>
  );
}
