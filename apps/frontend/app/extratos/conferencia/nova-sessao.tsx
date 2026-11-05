"use client";

import { useState } from "react";
import { ROTULO_DO_TIPO_DE_SESSAO, type Grupo, type Sessao, type TipoSessao } from "@finnagent/contracts";
import { Button } from "../../../components/ui/button";
import { campo, cn } from "../../../components/ui/cn";
import { Dialogo } from "../../../components/ui/dialogo";
import { Rotulo } from "../../../components/ui/rotulo";
import { Segmentado } from "../../../components/ui/segmentado";
import { useToast } from "../../../components/ui/toast";

const NOVO_GRUPO = "__novo__";
const field = cn(campo, "w-full");

export type PedidoDeNovaSessao = {
  /** O que a pessoa digitou na busca, ou a descrição da linha: vira o nome sugerido. */
  nome: string;
  /** Quem recebe a sessão criada: a linha ou a parte que estava escolhendo. */
  escolher: (id: string) => void;
};

async function api<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const corpo = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(corpo.message || "O backend não respondeu.");
  return corpo;
}

/**
 * Cria a sessão sem sair da Conferência, e o grupo junto se ele não existir. Usa as mesmas rotas da aba Grupos;
 * a sessão nova entra na lista e já fica escolhida na linha.
 */
export function DialogoDeNovaSessao({
  pedido,
  grupos,
  onCriada,
  onFechar,
}: {
  pedido: PedidoDeNovaSessao | null;
  grupos: Grupo[];
  onCriada: (sessao: Sessao, grupo: Grupo) => void;
  onFechar: () => void;
}) {
  return (
    <Dialogo aberto={pedido !== null} aria-labelledby="titulo-nova-sessao" onClose={onFechar}>
      {pedido ? <Corpo pedido={pedido} grupos={grupos} onCriada={onCriada} onFechar={onFechar} /> : null}
    </Dialogo>
  );
}

function Corpo({
  pedido,
  grupos,
  onCriada,
  onFechar,
}: {
  pedido: PedidoDeNovaSessao;
  grupos: Grupo[];
  onCriada: (sessao: Sessao, grupo: Grupo) => void;
  onFechar: () => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(pedido.nome.trim().slice(0, 160));
  const [grupoId, setGrupoId] = useState(grupos[0]?.id ?? NOVO_GRUPO);
  const [nomeDoGrupo, setNomeDoGrupo] = useState("");
  const [kind, setKind] = useState<TipoSessao>("acumulo");
  const [salvando, setSalvando] = useState(false);
  const grupoNovo = grupoId === NOVO_GRUPO;

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    const nomeDaSessao = nome.trim();
    if (!nomeDaSessao) {
      toast.erro("Dê um nome à sessão.");
      return;
    }
    if (grupoNovo && !nomeDoGrupo.trim()) {
      toast.erro("Dê um nome ao grupo.");
      return;
    }
    setSalvando(true);
    try {
      const grupo = grupoNovo
        ? await api<Grupo>("/api/grupos", { id: crypto.randomUUID(), name: nomeDoGrupo.trim(), description: "" })
        : grupos.find((item) => item.id === grupoId);
      if (!grupo) throw new Error("Escolha um grupo.");
      const sessao = await api<Sessao>("/api/sessoes", {
        id: crypto.randomUUID(),
        groupId: grupo.id,
        name: nomeDaSessao,
        description: "",
        justification: "",
        kind,
      });
      toast.sucesso(grupoNovo ? `Grupo "${grupo.name}" e sessão "${sessao.name}" criados.` : `Sessão "${sessao.name}" criada.`);
      onCriada(sessao, grupo);
      pedido.escolher(sessao.id);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível criar a sessão.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(event) => void salvar(event)}>
      <div className="dialog-corpo grid gap-4">
        <h2 id="titulo-nova-sessao" className="font-display text-lg">
          Nova sessão
        </h2>
        <div className="grid gap-1">
          <Rotulo htmlFor="nova-sessao-nome" dica="Como a sessão aparece em Grupos e em Finanças. Pode ser o nome do estabelecimento ou do gasto.">
            Nome
          </Rotulo>
          <input
            id="nova-sessao-nome"
            className={field}
            required
            maxLength={160}
            value={nome}
            onChange={(event) => setNome(event.target.value)}
          />
        </div>
        <div className="dialog-par">
          <div className="grid gap-1">
            <Rotulo htmlFor="nova-sessao-grupo" dica="O grupo que junta sessões parecidas, como Moradia ou Lazer. Sem grupo que sirva, crie um aqui.">
              Grupo
            </Rotulo>
            <select id="nova-sessao-grupo" className={field} value={grupoId} onChange={(event) => setGrupoId(event.target.value)}>
              {grupos.map((grupo) => (
                <option key={grupo.id} value={grupo.id}>
                  {grupo.name}
                </option>
              ))}
              <option value={NOVO_GRUPO}>Novo grupo</option>
            </select>
          </div>
          {grupoNovo ? (
            <div className="grid gap-1">
              <Rotulo htmlFor="nova-sessao-nome-do-grupo" dica="O nome do grupo novo.">
                Nome do grupo
              </Rotulo>
              <input
                id="nova-sessao-nome-do-grupo"
                className={field}
                required
                maxLength={160}
                value={nomeDoGrupo}
                onChange={(event) => setNomeDoGrupo(event.target.value)}
              />
            </div>
          ) : null}
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium" id="nova-sessao-tipo">
            Tipo
          </span>
          <Segmentado
            radio
            aria-labelledby="nova-sessao-tipo"
            opcoes={[
              { id: "acumulo", label: ROTULO_DO_TIPO_DE_SESSAO.acumulo },
              { id: "valor", label: ROTULO_DO_TIPO_DE_SESSAO.valor },
            ]}
            valor={kind}
            onEscolher={(escolhido) => setKind(escolhido as TipoSessao)}
          />
          <p className="text-xs text-ink-2">
            {kind === "valor"
              ? "Aceita uma transação única. Depois de lançada, sai das opções."
              : "Junta vários lançamentos: cada linha do extrato acumulada aqui soma no mês dela."}
          </p>
        </div>
      </div>
      <div className="dialog-acoes">
        <Button type="button" variant="quiet" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={salvando}>
          Criar sessão
        </Button>
      </div>
    </form>
  );
}
